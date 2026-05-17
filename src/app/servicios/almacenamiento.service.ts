import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { Hito, PosicionGPS } from '../modelos/interfaces';

@Injectable({
  providedIn: 'root'
})
export class AlmacenamientoService {

  private readonly HITOS_KEY = 'hitos_pendientes';
  private readonly IMAGENES_KEY = 'imagenes_pendientes';
  
  private readonly POSICIONES_KEY = 'posiciones_pendientes';


  // ==================== RF21 — HITOS ====================

  async guardarHitoPendiente(hito: Hito): Promise<void> {
    const hitos = await this.obtenerHitosPendientes();
    hitos.push(hito);
    await Preferences.set({
      key: this.HITOS_KEY,
      value: JSON.stringify(hitos)
    });
  }

  async obtenerHitosPendientes(): Promise<Hito[]> {
    const resultado = await Preferences.get({ key: this.HITOS_KEY });
    if (!resultado.value) return [];
    return JSON.parse(resultado.value) as Hito[];
  }

  async marcarHitoComoEnviado(index: number): Promise<void> {
    const hitos = await this.obtenerHitosPendientes();
    if (hitos[index]) {
      hitos[index].enviado = true;
      await Preferences.set({
        key: this.HITOS_KEY,
        value: JSON.stringify(hitos)
      });
    }
  }

  async limpiarHitosSincronizados(): Promise<void> {
    const hitos = await this.obtenerHitosPendientes();
    const pendientes = hitos.filter(h => !h.enviado);
    await Preferences.set({
      key: this.HITOS_KEY,
      value: JSON.stringify(pendientes)
    });
  }

  // ==================== RF22 — IMÁGENES ====================

  async guardarImagenPendiente(recorridoId: string, imagenBase64: string): Promise<void> {
    const imagenes = await this.obtenerImagenesPendientes();
    imagenes.push({ recorridoId, imagenBase64, enviado: false });
    await Preferences.set({
      key: this.IMAGENES_KEY,
      value: JSON.stringify(imagenes)
    });
  }

  async obtenerImagenesPendientes(): Promise<{ recorridoId: string; imagenBase64: string; enviado: boolean }[]> {
    const resultado = await Preferences.get({ key: this.IMAGENES_KEY });
    if (!resultado.value) return [];
    return JSON.parse(resultado.value);
  }

  async marcarImagenComoEnviada(index: number): Promise<void> {
    const imagenes = await this.obtenerImagenesPendientes();
    if (imagenes[index]) {
      imagenes[index].enviado = true;
      await Preferences.set({
        key: this.IMAGENES_KEY,
        value: JSON.stringify(imagenes)
      });
    }
  }

  async limpiarImagenesSincronizadas(): Promise<void> {
    const imagenes = await this.obtenerImagenesPendientes();
    const pendientes = imagenes.filter(i => !i.enviado);
    await Preferences.set({
      key: this.IMAGENES_KEY,
      value: JSON.stringify(pendientes)
    });
  }



// ==================== RF19/RF20 — POSICIONES GPS OFFLINE ====================

async guardarPosicionPendiente(recorridoId: string, posicion: PosicionGPS): Promise<void> {
  const posiciones = await this.obtenerPosicionesPendientes();
  posiciones.push({
    recorridoId,
    latitud: posicion.latitud,
    longitud: posicion.longitud,
    precision: posicion.precision,
    fechaRegistro: posicion.fechaRegistro ?? new Date(),
    enviado: false
  });
  await Preferences.set({
    key: this.POSICIONES_KEY,
    value: JSON.stringify(posiciones)
  });
}

async obtenerPosicionesPendientes(): Promise<{
  recorridoId: string;
  latitud: number;
  longitud: number;
  precision: number;
  fechaRegistro: Date;
  enviado: boolean;
}[]> {
  const resultado = await Preferences.get({ key: this.POSICIONES_KEY });
  if (!resultado.value) return [];
  return JSON.parse(resultado.value);
}

async limpiarPosicionesSincronizadas(): Promise<void> {
  const posiciones = await this.obtenerPosicionesPendientes();
  const pendientes = posiciones.filter(p => !p.enviado);
  await Preferences.set({
    key: this.POSICIONES_KEY,
    value: JSON.stringify(pendientes)
  });
}
}