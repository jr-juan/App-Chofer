import { Injectable } from '@angular/core';
import { Network } from '@capacitor/network';
import { AlmacenamientoService } from './almacenamiento.service';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class SincronizarService {

  private sincronizando = false;

  constructor(
    private almacenamientoService: AlmacenamientoService,
    private apiService: ApiService
  ) {}

  // ── Iniciar escucha de red ──
  iniciarEscuchaRed(): void {
    Network.addListener('networkStatusChange', async (status) => {
      console.log(' Red:', status.connected ? 'Conectado' : 'Sin conexión');
      if (status.connected) {
        await this.sincronizarTodo();
      }
    });
  }

  detenerEscuchaRed(): void {
    Network.removeAllListeners();
  }

  // ── RF23/RF24/RF25 — Sincronización batch ──
  async sincronizarTodo(): Promise<void> {
    if (this.sincronizando) return;
    this.sincronizando = true;
    console.log('🔄 Iniciando sincronización batch...');

    try {
      await this.sincronizarPosiciones();
      await this.sincronizarImagenes();
      await this.sincronizarHitos();
      console.log('✅ Sincronización completa');
    } catch (err) {
      console.error('❌ Error en sincronización:', err);
    } finally {
      this.sincronizando = false;
    }
  }

  // ── RF23 — Sincronizar posiciones pendientes ──
  private async sincronizarPosiciones(): Promise<void> {
    const posiciones = await this.almacenamientoService.obtenerPosicionesPendientes();
    const pendientes = posiciones.filter(p => !p.enviado);

    console.log(`📍 Posiciones pendientes: ${pendientes.length}`);

    for (const pos of pendientes) {
      try {
        await this.apiService.guardarPosicionGPS(pos.recorridoId, {
          latitud: pos.latitud,
          longitud: pos.longitud,
          precision: pos.precision,
          fechaRegistro: new Date(pos.fechaRegistro)
        }).toPromise();
        pos.enviado = true;
      } catch (err) {
        console.warn('❌ Error sincronizando posición:', err);
      }
    }

    await this.almacenamientoService.limpiarPosicionesSincronizadas();
  }

  // ── RF24 — Sincronizar imágenes pendientes ──
  private async sincronizarImagenes(): Promise<void> {
    const imagenes = await this.almacenamientoService.obtenerImagenesPendientes();
    const pendientes = imagenes.filter(i => !i.enviado);

    console.log(` Imágenes pendientes: ${pendientes.length}`);

    for (const img of pendientes) {
      try {
        await this.apiService.guardarEvidencia(
          img.recorridoId,
          img.imagenBase64,
          null
        ).toPromise();
        img.enviado = true;
      } catch (err) {
        console.warn('❌ Error sincronizando imagen:', err);
      }
    }

    await this.almacenamientoService.limpiarImagenesSincronizadas();
  }

  // ── RF25 — Sincronizar hitos pendientes ──
  private async sincronizarHitos(): Promise<void> {
    const hitos = await this.almacenamientoService.obtenerHitosPendientes();
    const pendientes = hitos.filter(h => !h.enviado);

    console.log(` Hitos pendientes: ${pendientes.length}`);

    for (const hito of pendientes) {
      try {
        await this.apiService.guardarHitoFirestore(hito).toPromise();
        hito.enviado = true;
      } catch (err) {
        console.warn('❌ Error sincronizando hito:', err);
      }
    }

    await this.almacenamientoService.limpiarHitosSincronizados();
  }

  // ── Verificar conexión actual ──
  async hayConexion(): Promise<boolean> {
    const status = await Network.getStatus();
    return status.connected;
  }
}