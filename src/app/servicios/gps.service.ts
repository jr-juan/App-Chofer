import { Injectable } from "@angular/core";
import { Geolocation, Position } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";
import { BehaviorSubject, Observable } from "rxjs";
import { PosicionGPS } from "../modelos/interfaces";

@Injectable({
  providedIn: "root",
})
export class GpsService {

  private watchId: string | null = null;
  private _posicionActual = new BehaviorSubject<PosicionGPS | null>(null);
  private _gpsActivo = new BehaviorSubject<boolean>(false);

  private ultimaPosicion: PosicionGPS | null = null;

  private ultimoEnvio: number = 0;
  private INTERVALO_MS = 30000; // 30 segundos
  private DISTANCIA_MIN = 10; // 10 metros

  private distanciaAcumulada: number = 0;
  private DISTANCIA_HITO = 1000; // 1 km en metros
  private _hitoAlcanzado = new BehaviorSubject<number | null>(null);

  hitoAlcanzado$: Observable<number | null> =
    this._hitoAlcanzado.asObservable();

  posicionActual$: Observable<PosicionGPS | null> =
    this._posicionActual.asObservable();
  gpsActivo$: Observable<boolean> = this._gpsActivo.asObservable();

  private _gpsDisponible = new BehaviorSubject<boolean>(false);
  gpsDisponible$: Observable<boolean> = this._gpsDisponible.asObservable();
  private poleoInterval: any = null;

  async solicitarPermisos(): Promise<boolean> {
    try {
      const permiso = await Geolocation.requestPermissions();
      return permiso.location === "granted";
    } catch (err) {
      console.error("Error solicitando permisos GPS:", err);
      return false;
    }
  }

  async iniciarSeguimiento(): Promise<boolean> {
    if (this._gpsActivo.getValue()) return true;

    const tienePermiso = await this.solicitarPermisos();
    if (!tienePermiso) {
      console.warn("Permiso GPS denegado");
      return false;
    }

    try {
      this.watchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 10000,
        },
        (position, err) => {
          if (err) {
            console.error("Error GPS:", err);
            return;
          }
          if (position) {
            if (position) {
              const posicion: PosicionGPS = {
                latitud: position.coords.latitude,
                longitud: position.coords.longitude,
                precision: position.coords.accuracy,
                fechaRegistro: new Date(),
              };

              if (this.debeEnviar(posicion)) {
                // Acumular distancia para hitos
                if (this.ultimaPosicion) {
                  const metros = this.calcularDistancia(
                    this.ultimaPosicion.latitud,
                    this.ultimaPosicion.longitud,
                    posicion.latitud,
                    posicion.longitud,
                  );
                  this.distanciaAcumulada += metros;

                  const kmActual = Math.floor(
                    this.distanciaAcumulada / this.DISTANCIA_HITO,
                  );
                  const kmAnterior = Math.floor(
                    (this.distanciaAcumulada - metros) / this.DISTANCIA_HITO,
                  );

                  if (kmActual > kmAnterior) {
                    this._hitoAlcanzado.next(kmActual); // emite el km que se cumplió
                  }
                }

                this.ultimaPosicion = posicion;
                this.ultimoEnvio = Date.now();
                this._posicionActual.next(posicion);
              }
            }
          }
        },
      );

      this._gpsActivo.next(true);
      return true;
    } catch (err) {
      console.error("Error iniciando GPS:", err);
      return false;
    }
  }

  async detenerSeguimiento(): Promise<void> {
    if (this.watchId !== null) {
      await Geolocation.clearWatch({ id: this.watchId });
      this.watchId = null;
    }
    this._gpsActivo.next(false);
    this._posicionActual.next(null);
    this.ultimaPosicion = null;
    this.ultimoEnvio = 0;
    this.distanciaAcumulada = 0;
    this._hitoAlcanzado.next(null);
  }

  async obtenerPosicionUnica(): Promise<PosicionGPS | null> {
    try {
      const position: Position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });
      return {
        latitud: position.coords.latitude,
        longitud: position.coords.longitude,
        precision: position.coords.accuracy,
        fechaRegistro: new Date(),
      };
    } catch (err) {
      console.error("Error obteniendo posición:", err);
      return null;
    }
  }

  get estaActivo(): boolean {
    return this._gpsActivo.getValue();
  }

  // Verificar permisos GPS antes de iniciar recorrido
  async verificarPermisos(): Promise<{
    otorgado: boolean;
    denegadoPermanente: boolean;
  }> {
    try {
      //  En web dejamos pasar siempre
      if (Capacitor.getPlatform() === "web") {
        return { otorgado: true, denegadoPermanente: false };
      }

      const status = await Geolocation.checkPermissions();

      if (status.location === "granted") {
        return { otorgado: true, denegadoPermanente: false };
      }

      if (
        status.location === "prompt" ||
        status.location === "prompt-with-rationale"
      ) {
        const request = await Geolocation.requestPermissions();
        return {
          otorgado: request.location === "granted",
          denegadoPermanente: false,
        };
      }

      return { otorgado: false, denegadoPermanente: true };
    } catch (error) {
      console.error("Error verificando permisos:", error);
      return { otorgado: false, denegadoPermanente: false };
    }
  }

  private calcularDistancia(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  debeEnviar(posicion: PosicionGPS): boolean {
    const ahora = Date.now();
    const tiempoPasado = ahora - this.ultimoEnvio >= this.INTERVALO_MS;

    if (!this.ultimaPosicion) return true;

    const distancia = this.calcularDistancia(
      this.ultimaPosicion.latitud,
      this.ultimaPosicion.longitud,
      posicion.latitud,
      posicion.longitud,
    );

    return tiempoPasado && distancia >= this.DISTANCIA_MIN;
  }

  iniciarDeteccionEstado(): void {
    if (this.poleoInterval) return;

    const verificar = async () => {
      try {
        await Geolocation.getCurrentPosition({
          timeout: 3000,
          enableHighAccuracy: false,
        });
        this._gpsDisponible.next(true);
      } catch {
        this._gpsDisponible.next(false);
      }
    };

    verificar();
    this.poleoInterval = setInterval(verificar, 1500);
  }

  detenerDeteccionEstado(): void {
    if (this.poleoInterval) {
      clearInterval(this.poleoInterval);
      this.poleoInterval = null;
    }
  }


getPosicionActual(): PosicionGPS | null {
  return this._posicionActual.getValue();
}
}
