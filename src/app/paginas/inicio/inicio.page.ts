import { Component, OnInit, OnDestroy, ChangeDetectorRef } from "@angular/core";
import { ApiService } from "../../servicios/api.service";
import { AuthService } from "../../servicios/auth.service";
import { GpsService } from "../../servicios/gps.service";
import { Vehiculo, Ruta, PosicionGPS } from "../../modelos/interfaces";
import { forkJoin, Subscription } from "rxjs";

@Component({
  selector: "app-inicio",
  templateUrl: "./inicio.page.html",
  styleUrls: ["./inicio.page.css"],
})
export class InicioPage implements OnInit, OnDestroy {
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

  // Notificaciones modal
  mostrarNotificacion = false;
  notificacionTipo: "exito" | "error" | "info" = "info";
  notificacionMensaje = "";

  pendienteAbrirAjustes = false;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private gpsService: GpsService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.nombreChofer = this.authService.currentUser?.displayName || "Chofer";
    this.cargarDatos();

    this.gpsActivoSub = this.gpsService.gpsActivo$.subscribe((activo) => {
      console.log("Estado GPS actualizado:", activo);
      this.gpsActivo = activo;
      this.cdr.detectChanges();
    });

    this.gpsSub = this.gpsService.posicionActual$.subscribe((pos) => {
      console.log("Posición GPS actualizada:", pos);
      this.posicionActual = pos;
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy() {
    this.gpsSub?.unsubscribe();
    this.gpsActivoSub?.unsubscribe();
  }

  mostrarAlerta(mensaje: string, tipo: "exito" | "error" | "info" = "info") {
    this.notificacionMensaje = mensaje;
    this.notificacionTipo = tipo;
    this.mostrarNotificacion = true;
  }

  cerrarNotificacion() {
  this.mostrarNotificacion = false;
}

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
        this.cargando = false;
      },
      error: (err) => {
        console.error("Error cargando datos:", err);
        this.mostrarAlerta("Error al cargar los datos.", "error");
        this.cargando = false;
      },
    });
  }

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

  async confirmarInicioRecorrido() {
    if (!this.vehiculoSeleccionado || !this.rutaSeleccionada) {
      this.mostrarAlerta("Debes seleccionar un vehículo y una ruta.", "error");
      return;
    }
    // Verificar permisos GPS antes de iniciar recorrido
    const { otorgado, denegadoPermanente } =
      await this.gpsService.verificarPermisos();

    if (!otorgado) {
      this.cerrarModalRecorrido();

      if (denegadoPermanente) {
        this.mostrarAlerta(
          "📍 Permiso de ubicación bloqueado. Ve a Ajustes del celular → Aplicaciones → EcoRuta → Permisos → Ubicación y actívalo.",
          "error",
        );
      } else {
        this.mostrarAlerta(
          "📍 La app necesita acceso a tu ubicación para registrar el recorrido. Por favor actívalo en los ajustes.",
          "info",
        );
      }
      return;
    }

    // Continúa normal si tiene permisos
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

  async detenerGPS() {
    await this.gpsService.detenerSeguimiento();
    this.mostrarAlerta("GPS detenido correctamente.", "info");
  }

  cerrarSesion() {
    this.mostrarModalCerrarSesion = false;
    this.authService.logout();
  }

  doRefresh(event: any) {
    this.cargarDatos();
    setTimeout(() => event.target.complete(), 1000);
  }
}
