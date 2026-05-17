import { Component, OnInit, OnDestroy, ChangeDetectorRef } from "@angular/core";
import { ApiService } from "../../servicios/api.service";
import { AuthService } from "../../servicios/auth.service";
import { GpsService } from "../../servicios/gps.service";
import {
  Vehiculo,
  Ruta,
  PosicionGPS,
  Hito,
  Recorrido,
} from "../../modelos/interfaces";
import { forkJoin, Subscription } from "rxjs";
import { CamaraService } from "../../servicios/camara.service";
import { AlmacenamientoService } from "../../servicios/almacenamiento.service";
import { SincronizarService } from "../../servicios/sincronizar.service";
import { App } from "@capacitor/app";

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

  private guardandoEvidencia = false;

  recorridoActivo:
    | (Recorrido & { vehiculo?: Vehiculo | null; ruta?: Ruta | null })
    | null = null;

  // GPS
  gpsActivo = false;
  posicionActual: PosicionGPS | null = null;
  private gpsSub: Subscription | null = null;
  private gpsActivoSub: Subscription | null = null;
  private hitoSub: Subscription | null = null;

  gpsActivando = false;
  gpsIniciando = false;

  gpsDisponible = false;
  private gpsDisponibleSub: Subscription | null = null;

  private gpsDisponibleAnterior = false;

  // Notificaciones
  mostrarNotificacion = false;
  notificacionTipo: "exito" | "error" | "info" | "advertencia" = "info";
  notificacionMensaje = "";

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private gpsService: GpsService,
    private cdr: ChangeDetectorRef,
    private camaraService: CamaraService,
    private almacenamientoService: AlmacenamientoService,
    private sincronizarService: SincronizarService,
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
  if (km !== null && this.recorridoActivo?.id) {
    // RF29 — No registrar hitos si está suspendido
    if (this.recorridoActivo.estado === "suspendido") return;
        this.mostrarAlerta(
          `¡Hito alcanzado! Llevas ${km} km en la ruta ${this.recorridoActivo.ruta?.nombre_ruta || this.recorridoActivo.rutaId}.`,
          "info",
        );

        const hito: Hito = {
          recorridoId: this.recorridoActivo.id,
          kilometro: km,
          latitud: this.posicionActual?.latitud ?? 0,
          longitud: this.posicionActual?.longitud ?? 0,
          fechaRegistro: new Date(),
          imagenBase64: "",
          enviado: false,
        };

        this.apiService.guardarHitoFirestore(hito).subscribe({
          next: () => console.log("Hito guardado en Firestore"),
          error: (err) => {
            console.error("Error guardando hito en Firestore:", err);
            this.almacenamientoService.guardarHitoPendiente(hito);
          },
        });
      }
    });

    // RF10/RF11 — Suscripción a posiciones GPS + envío a Firestore
    this.gpsSub = this.gpsService.posicionActual$.subscribe((pos) => {
      this.posicionActual = pos;
      this.cdr.detectChanges();

      
if (pos && this.recorridoActivo?.id && this.recorridoActivo.estado !== "suspendido") {
        this.apiService
          .guardarPosicionGPS(this.recorridoActivo.id, pos)
          .subscribe({
            error: (err) => console.error("Error guardando posición:", err),
          });
      }
    });

    // Detección de GPS físico del celular
    this.gpsService.iniciarDeteccionEstado();

    // Muestra cargando cuando el GPS se enciende manualmente
    this.gpsDisponibleSub = this.gpsService.gpsDisponible$.subscribe(
      (disponible) => {
        if (!this.gpsDisponibleAnterior && disponible) {
          this.gpsIniciando = true;
          this.cdr.detectChanges();
          setTimeout(() => {
            this.gpsIniciando = false;
            this.cdr.detectChanges();
          }, 2000);
        }
        this.gpsDisponibleAnterior = disponible;
        this.gpsDisponible = disponible;
        this.cdr.detectChanges();
      },
    );

    // Recargar datos cuando la app vuelve al foco (ej: después de cámara)
    App.addListener("appStateChange", async ({ isActive }) => {
      if (isActive) {
        if (!this.guardandoEvidencia) {
          this.cargarDatos();
        }
        
if (this.recorridoActivo && this.recorridoActivo.estado !== "suspendido" && !this.gpsService.estaActivo) {
          await this.gpsService.iniciarSeguimiento();
        }
      }
    });

    // Iniciar escucha de red para sincronización offline
    this.sincronizarService.iniciarEscuchaRed();
  }

  ngOnDestroy() {
    this.gpsSub?.unsubscribe();
    this.gpsActivoSub?.unsubscribe();
    this.gpsDisponibleSub?.unsubscribe();
    this.gpsService.detenerDeteccionEstado();
    this.hitoSub?.unsubscribe();
    this.sincronizarService.detenerEscuchaRed();
    App.removeAllListeners();
  }

  // ── Notificaciones ──

mostrarAlerta(
  mensaje: string,
  tipo: "exito" | "error" | "info" | "advertencia" = "info",
) {
    this.notificacionMensaje = mensaje;
    this.notificacionTipo = tipo;
    this.mostrarNotificacion = true;
  }

  get recorridoSuspendido(): boolean {
  return this.recorridoActivo?.estado === "suspendido";
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

        // No sobreescribir recorridoActivo si hay evidencia guardándose
        if (recorrido) {
  const rec = recorrido as Recorrido & { id: string };

  this.apiService.verificarYSuspenderRecorrido(rec).subscribe({
    next: (fueSuspendido) => {
      if (fueSuspendido) {
        rec.estado = "suspendido";
        this.gpsService.detenerSeguimiento();
        this.mostrarAlerta(
          "Tu recorrido ha sido suspendido por superar las 24 horas permitidas. No se enviarán más datos. ",
          "advertencia",
        );
      }
      this.recorridoActivo = {
        ...rec,
        vehiculo: this.vehiculosAsignados.find((v) => v.id === rec.vehiculoId) || null,
        ruta: this.rutasAsignadas.find((r) => r.id === rec.rutaId) || null,
      };
      this.cargando = false;
      this.cdr.detectChanges();
    },
    error: () => {
      this.recorridoActivo = {
        ...rec,
        vehiculo: this.vehiculosAsignados.find((v) => v.id === rec.vehiculoId) || null,
        ruta: this.rutasAsignadas.find((r) => r.id === rec.rutaId) || null,
      };
      this.cargando = false;
      this.cdr.detectChanges();
    },
  });
} else {
  this.recorridoActivo = null;
  this.cargando = false;
}
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
            vehiculoId: this.vehiculoSeleccionado!.id!,
            rutaId: this.rutaSeleccionada!.id!,
            vehiculo: this.vehiculoSeleccionado,
            ruta: this.rutaSeleccionada,
            estado: "activo",
            fechaInicio: new Date(),
            fechaFin: null,
          };
          this.iniciandoRecorrido = false;
          this.cerrarModalRecorrido();

          this.gpsIniciando = true;

          const gpsIniciado = await this.gpsService.iniciarSeguimiento();

          // Simular tiempo de inicio del GPS para mostrar el estado "Activando GPS..."
          this.gpsIniciando = false;
          this.cdr.detectChanges();

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

  // Reanudar GPS con recorrido activo

 async reanudarGPS() {
  if (this.recorridoSuspendido) {
    this.mostrarAlerta(
      "No puedes reanudar el GPS en un recorrido suspendido.",
      "advertencia",
    );
    return;
  }
  const gpsIniciado = await this.gpsService.iniciarSeguimiento();
  if (gpsIniciado) {
    this.mostrarAlerta("GPS reanudado correctamente.", "exito");
  } else {
    this.mostrarAlerta(
      "No se pudo reanudar el GPS. Verifica los permisos.",
      "error",
    );
  }
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
  if (this.guardandoEvidencia) return;

  // RF29 — Bloquear si está suspendido
  if (this.recorridoSuspendido) {
    this.mostrarAlerta(
      "No puedes capturar evidencia en un recorrido suspendido.",
      "advertencia",
    );
    return;
  }

  const recorridoId = this.recorridoActivo?.id;

  if (!recorridoId) {
    this.mostrarAlerta(
      "Debes tener un recorrido activo para capturar evidencia.",
      "info",
    );
    return;
  }

  this.guardandoEvidencia = true;

  let base64: string | null = null;
  try {
    base64 = await this.camaraService.tomarFoto();
  } catch (err) {
    console.error("Error cámara:", err);
    this.mostrarAlerta("Error al abrir la cámara.", "error");
    this.guardandoEvidencia = false;
    return;
  }

  if (!base64) {
    this.mostrarAlerta("No se pudo capturar la foto.", "error");
    this.guardandoEvidencia = false;
    return;
  }

  const hayConexion = await this.sincronizarService.hayConexion();
  if (!hayConexion) {
    await this.almacenamientoService.guardarImagenPendiente(
      recorridoId,
      base64,
    );
  }

  this.apiService
    .guardarEvidencia(recorridoId, base64, this.posicionActual)
    .subscribe({
      next: () => {
        this.guardandoEvidencia = false;
        this.mostrarAlerta("Evidencia guardada correctamente.", "exito");
      },
      error: async (err) => {
        console.error("Error guardando evidencia:", err);
        this.guardandoEvidencia = false;
        if (!hayConexion) {
          this.mostrarAlerta(
            "Conexión inestable — evidencia guardada localmente. Se sincronizará cuando haya señal.",
            "info",
          );
        } else {
          await this.almacenamientoService.guardarImagenPendiente(
            recorridoId,
            base64!,
          );
          this.mostrarAlerta(
            "Error al guardar evidencia — guardada localmente.",
            "info",
          );
        }
      },
    });
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
