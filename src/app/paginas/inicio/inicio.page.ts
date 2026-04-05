import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../servicios/api.service';
import { AuthService } from '../../servicios/auth.service';
import { Vehiculo, Ruta, Recorrido } from '../../modelos/interfaces';
 import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-inicio',
  templateUrl: './inicio.page.html',
  styleUrls: ['./inicio.page.css'],
})
export class InicioPage implements OnInit {

  vehiculosAsignados: Vehiculo[] = [];
  vehiculosActivos = 0;
  rutasAsignadas: Ruta[] = [];
  nombreChofer = '';
  cargando = false;
  mensajeError = '';
  mensajeExito = '';
  mostrarModalCerrarSesion = false;

  
  mostrarModalRecorrido = false;
  vehiculoSeleccionado: Vehiculo | null = null;
  rutaSeleccionada: Ruta | null = null;
  iniciandoRecorrido = false;

 
  recorridoActivo: any = null;

  constructor(
    private apiService: ApiService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.nombreChofer = this.authService.currentUser?.displayName || 'Chofer';
    this.cargarDatos();
  }

 

cargarDatos() {
  this.cargando = true;
  this.mensajeError = '';
  const choferId = this.authService.currentUser?.uid;

  if (!choferId) {
    this.mensajeError = 'No se encontró el ID del chofer.';
    this.cargando = false;
    return;
  }

  forkJoin({
    vehiculos: this.apiService.obtenerVehiculosDelChofer(choferId),
    rutas: this.apiService.obtenerRutasDelChofer(choferId),
    recorrido: this.apiService.obtenerRecorridoActivo(choferId)
  }).subscribe({
    next: ({ vehiculos, rutas, recorrido }) => {
      this.vehiculosAsignados = vehiculos.data || [];
      this.vehiculosActivos = this.vehiculosAsignados.filter(v => v.activo).length;
      this.rutasAsignadas = rutas.data || [];
      this.recorridoActivo = recorrido;
      this.cargando = false;
    },
    error: (err) => {
      console.error('Error cargando datos:', err);
      this.mensajeError = 'Error al cargar los datos.';
      this.cargando = false;
    }
  });


    this.apiService.obtenerRutasDelChofer(choferId).subscribe({
      next: (res) => {
        this.rutasAsignadas = res.data || [];
        this.cargando = false;
      },
      error: (err) => {
        console.error('Error rutas:', err);
        this.mensajeError = 'Error al cargar tus rutas asignadas.';
        this.cargando = false;
      }
    });

    // verificar si ya tiene recorrido activo
    this.apiService.obtenerRecorridoActivo(choferId).subscribe({
      next: (recorrido) => {
        this.recorridoActivo = recorrido;
      },
      error: (err) => console.error('Error verificando recorrido activo:', err)
    });
  }

  
  abrirModalRecorrido() {
    if (this.recorridoActivo) {
      this.mensajeError = 'Ya tienes un recorrido activo. Debes finalizarlo antes de iniciar uno nuevo.';
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

  
  confirmarInicioRecorrido() {
    if (!this.vehiculoSeleccionado || !this.rutaSeleccionada) {
      this.mensajeError = 'Debes seleccionar un vehículo y una ruta.';
      return;
    }

    const choferId = this.authService.currentUser?.uid;
    if (!choferId) return;

    this.iniciandoRecorrido = true;

    this.apiService.iniciarRecorrido(
      choferId,
      this.vehiculoSeleccionado.id!,
      this.rutaSeleccionada.id!
    ).subscribe({
      next: (idRecorrido) => {
        this.recorridoActivo = {
          id: idRecorrido,
          choferId,
          vehiculoId: this.vehiculoSeleccionado!.id,
          rutaId: this.rutaSeleccionada!.id,
          estado: 'activo',
          fechaInicio: new Date()
        };
        this.mensajeExito = `Recorrido iniciado: ${this.rutaSeleccionada!.nombre_ruta} con vehículo ${this.vehiculoSeleccionado!.placa}`;
        this.iniciandoRecorrido = false;
        this.cerrarModalRecorrido();

        // GPS NO se activa aquí, queda para RF8 con acción explícita
      },
      error: (err) => {
        console.error('Error iniciando recorrido:', err);
        this.mensajeError = 'Error al iniciar el recorrido.';
        this.iniciandoRecorrido = false;
      }
    });
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