import { Component, OnInit, OnDestroy, ChangeDetectorRef } from "@angular/core";
import { ApiService } from "../../servicios/api.service";
import { AuthService } from "../../servicios/auth.service";
import { GpsService } from "../../servicios/gps.service";
import { Vehiculo, Ruta, PosicionGPS } from "../../modelos/interfaces";
import { forkJoin, Subscription } from "rxjs";
import { CamaraService } from '../../servicios/camara.service';
import { AlmacenamientoService } from '../../servicios/almacenamiento.service';

@Component({
  selector: "app-inicio",
  templateUrl: "./inicio.page.html",
  styleUrls: ["./inicio.page.css"],
})
export class InicioPage implements OnInit, OnDestroy {
  // ── Propiedades ──
  vehiculosAsignados: Vehiculo[] = [];
  vehiculosActivos = 0;
  rutasAsignadas: Ruta[] = [];
  nombreChofer = "";
  cargando = false;
  mostrarModalCerrarSesion = false;
  mostrarModalRecorrido = false;
  vehiculoSeleccionado: Vehiculo | null = null;
  rutaSeleccionada: Ruta | null = null;
  iniciandoRecorrido = false;
  recorridoActivo: any = null;

  // GPS
  gpsActivo = false;
  posicionActual: PosicionGPS | null = null;
  private gpsSub: Subscription | null = null;
  private gpsActivoSub: Subscription | null = null;
  private hitoSub: Subscription | null = null;

  gpsDisponible = false;
  private gpsDisponibleSub: Subscription | null = null;

  // Notificaciones
  mostrarNotificacion = false;
  notificacionTipo: "exito" | "error" | "info" = "info";
  notificacionMensaje = "";

  constructor(
  private apiService: ApiService,
  private authService: AuthService,
  private gpsService: GpsService,
  private cdr: ChangeDetectorRef,
  private camaraService: CamaraService,           
  private almacenamientoService: AlmacenamientoService  
) {}

  // ── RF3 — Ciclo de vida ──

ngOnInit() {
  this.nombreChofer = this.authService.currentUser?.displayName || "Chofer";
  this.cargarDatos();

  // RF8/RF9 — Suscripción al estado del GPS
  this.gpsActivoSub = this.gpsService.gpsActivo$.subscribe((activo) => {
    this.gpsActivo = activo;
    this.cdr.detectChanges();
  });

  // RF14 — Alerta de hito cada 1 km
  this.hitoSub = this.gpsService.hitoAlcanzado$.subscribe((km) => {
    if (km !== null) {
      this.mostrarAlerta(`🏁 ¡Hito alcanzado! Llevas ${km} km recorrido(s).`, 'info');
    }
  });

  // RF10/RF11 — Suscripción a posiciones GPS + envío a Firestore
  this.gpsSub = this.gpsService.posicionActual$.subscribe((pos) => {
    this.posicionActual = pos;
    this.cdr.detectChanges();

    if (pos && this.recorridoActivo?.id) {
      this.apiService
        .guardarPosicionGPS(this.recorridoActivo.id, pos)
        .subscribe({
          error: (err) => console.error("Error guardando posición:", err),
        });
    }
  });

  // Detección de GPS físico del celular
  this.gpsService.iniciarDeteccionEstado();
  this.gpsDisponibleSub = this.gpsService.gpsDisponible$.subscribe(
    (disponible) => {
      this.gpsDisponible = disponible;
      this.cdr.detectChanges();
    },
  );
}

  ngOnDestroy() {
    this.gpsSub?.unsubscribe();
    this.gpsActivoSub?.unsubscribe();
    this.gpsDisponibleSub?.unsubscribe();
    this.gpsService.detenerDeteccionEstado();
    this.hitoSub?.unsubscribe();
  }

  // ── Notificaciones ──

  mostrarAlerta(mensaje: string, tipo: "exito" | "error" | "info" = "info") {
    this.notificacionMensaje = mensaje;
    this.notificacionTipo = tipo;
    this.mostrarNotificacion = true;
  }

  cerrarNotificacion() {
    this.mostrarNotificacion = false;
  }

  // ── RF4/RF5 — Carga de datos del chofer ──

  cargarDatos() {
    this.cargando = true;
    const choferId = this.authService.currentUser?.uid;

    if (!choferId) {
      this.mostrarAlerta("No se encontró el ID del chofer.", "error");
      this.cargando = false;
      return;
    }

    forkJoin({
      vehiculos: this.apiService.obtenerVehiculosDelChofer(choferId),
      rutas: this.apiService.obtenerRutasDelChofer(choferId),
      recorrido: this.apiService.obtenerRecorridoActivo(choferId),
    }).subscribe({
      next: ({ vehiculos, rutas, recorrido }) => {
        this.vehiculosAsignados = vehiculos.data || [];
        this.vehiculosActivos = this.vehiculosAsignados.filter(
          (v) => v.activo,
        ).length;
        this.rutasAsignadas = rutas.data || [];
        this.recorridoActivo = recorrido;

        // Enriquecer recorrido activo con objetos completos para mostrar nombres
        if (recorrido) {
          this.recorridoActivo.vehiculo =
            this.vehiculosAsignados.find(
              (v) => v.id === recorrido.vehiculoId,
            ) || null;
          this.recorridoActivo.ruta =
            this.rutasAsignadas.find((r) => r.id === recorrido.rutaId) || null;
        }

        this.cargando = false;
      },
      error: (err) => {
        console.error("Error cargando datos:", err);
        this.mostrarAlerta("Error al cargar los datos.", "error");
        this.cargando = false;
      },
    });
  }

  // ── RF6 — Modal de recorrido ──

  abrirModalRecorrido() {
    if (this.recorridoActivo) {
      this.mostrarAlerta(
        "Ya tienes un recorrido activo. Debes finalizarlo antes de iniciar uno nuevo.",
        "info",
      );
      return;
    }
    this.vehiculoSeleccionado = null;
    this.rutaSeleccionada = null;
    this.mostrarModalRecorrido = true;
  }

  cerrarModalRecorrido() {
    this.mostrarModalRecorrido = false;
    this.vehiculoSeleccionado = null;
    this.rutaSeleccionada = null;
  }

  seleccionarVehiculo(vehiculo: Vehiculo) {
    this.vehiculoSeleccionado = vehiculo;
  }

  seleccionarRuta(ruta: Ruta) {
    this.rutaSeleccionada = ruta;
  }

  // ── RF6/RF7/RF8/RF9 — Confirmar inicio de recorrido + activar GPS ──

  async confirmarInicioRecorrido() {
    if (!this.vehiculoSeleccionado || !this.rutaSeleccionada) {
      this.mostrarAlerta("Debes seleccionar un vehículo y una ruta.", "error");
      return;
    }

    // RF8/RF9 — Verificar permisos GPS antes de iniciar
    const { otorgado, denegadoPermanente } =
      await this.gpsService.verificarPermisos();

    if (!otorgado) {
      this.cerrarModalRecorrido();
      if (denegadoPermanente) {
        this.mostrarAlerta(
          "Permiso de ubicación bloqueado. Ve a Ajustes del celular → Aplicaciones → EcoRuta → Permisos → Ubicación y actívalo.",
          "error",
        );
      } else {
        this.mostrarAlerta(
          "La app necesita acceso a tu ubicación para registrar el recorrido. Por favor actívalo en los ajustes.",
          "info",
        );
      }
      return;
    }

    const choferId = this.authService.currentUser?.uid;
    if (!choferId) return;

    this.iniciandoRecorrido = true;

    this.apiService
      .iniciarRecorrido(
        choferId,
        this.vehiculoSeleccionado.id!,
        this.rutaSeleccionada.id!,
      )
      .subscribe({
        next: async (idRecorrido) => {
          this.recorridoActivo = {
            id: idRecorrido,
            choferId,
            vehiculoId: this.vehiculoSeleccionado!.id,
            rutaId: this.rutaSeleccionada!.id,
            vehiculo: this.vehiculoSeleccionado,
            ruta: this.rutaSeleccionada,
            estado: "activo",
            fechaInicio: new Date(),
          };
          this.iniciandoRecorrido = false;
          this.cerrarModalRecorrido();

          // RF8/RF9 — Iniciar seguimiento GPS
          const gpsIniciado = await this.gpsService.iniciarSeguimiento();
          if (gpsIniciado) {
            this.mostrarAlerta("Recorrido iniciado — GPS activo", "exito");
          } else {
            this.mostrarAlerta(
              "No se pudo activar el GPS. Verifica los permisos.",
              "error",
            );
          }
        },
        error: (err) => {
          console.error("Error iniciando recorrido:", err);
          this.mostrarAlerta("Error al iniciar el recorrido.", "error");
          this.iniciandoRecorrido = false;
        },
      });
  }

  // ── RF8/RF9 — Detener solo el GPS  ──

  async detenerGPS() {
    await this.gpsService.detenerSeguimiento();
    this.mostrarAlerta("GPS detenido. El recorrido sigue activo.", "info");
  }


  // ─ RF26 — Finalizar recorrido manualmente + detener GPS ─

  async finalizarRecorrido() {
    if (!this.recorridoActivo?.id) return;

    this.apiService.finalizarRecorrido(this.recorridoActivo.id).subscribe({
      next: async () => {
        await this.gpsService.detenerSeguimiento();
        this.recorridoActivo = null;
        this.mostrarAlerta("Recorrido finalizado correctamente", "exito");
      },
      error: (err) => {
        console.error("Error finalizando recorrido:", err);
        this.mostrarAlerta("Error al finalizar el recorrido.", "error");
      },
    });
  }

// RF15 — Captura de evidencia fotográfica
async capturarEvidencia() {
  if (!this.recorridoActivo?.id) {
    this.mostrarAlerta('Debes tener un recorrido activo para capturar evidencia.', 'info');
    return;
  }

  const base64 = await this.camaraService.tomarFoto();

  if (!base64) {
    this.mostrarAlerta('No se pudo capturar la foto.', 'error');
    return;
  }

  await this.almacenamientoService.guardarImagenPendiente(
    this.recorridoActivo.id,
    base64
  );

  this.mostrarAlerta('Evidencia guardada correctamente.', 'exito');
}

  // ── Sesión ──

  cerrarSesion() {
    this.mostrarModalCerrarSesion = false;
    this.authService.logout();
  }

  doRefresh(event: any) {
    this.cargarDatos();
    setTimeout(() => event.target.complete(), 1000);
  }
}
