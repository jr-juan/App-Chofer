import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../servicios/api.service';
import { AuthService } from '../../servicios/auth.service';
import { Vehiculo } from '../../modelos/interfaces';

@Component({
  selector: 'app-inicio',
  templateUrl: './inicio.page.html',
  styleUrls: ['./inicio.page.css'],
})
export class InicioPage implements OnInit {

  vehiculosAsignados: Vehiculo[] = [];
  vehiculosActivos = 0;
  nombreChofer = '';
  cargando = false;
  mensajeError = '';
  mostrarModalCerrarSesion = false;

  constructor(
    private apiService: ApiService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.nombreChofer = this.authService.currentUser?.displayName || 'Chofer';
    this.cargarVehiculosAsignados();
  }

  cargarVehiculosAsignados() {
    this.cargando = true;
    this.mensajeError = '';
    const choferId = this.authService.currentUser?.uid;

    if (!choferId) {
      this.mensajeError = 'No se encontró el ID del chofer.';
      this.cargando = false;
      return;
    }

    this.apiService.obtenerVehiculosDelChofer(choferId).subscribe({
      next: (res) => {
        this.vehiculosAsignados = res.data || [];
        this.vehiculosActivos = this.vehiculosAsignados.filter(v => v.activo).length;
        this.cargando = false;
      },
      error: (err) => {
        this.mensajeError = 'Error al cargar tus vehículos asignados.';
        console.error(err);
        this.cargando = false;
      },
    });
  }

  cerrarSesion() {
    this.mostrarModalCerrarSesion = false;
    this.authService.logout();
  }

  doRefresh(event: any) {
    this.cargarVehiculosAsignados();
    setTimeout(() => event.target.complete(), 1000);
  }
}