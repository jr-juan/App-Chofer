import { Injectable } from '@angular/core';
import { Network } from '@capacitor/network';
import { AlmacenamientoService } from './almacenamiento.service';
import { ApiService } from './api.service';
import { firebaseDB } from './firebase.config';
import { collection, query, where, getDocs, updateDoc, doc, getDoc } from 'firebase/firestore';

@Injectable({
  providedIn: 'root'
})
export class SincronizarService {

  private sincronizando = false;

  constructor(
    private almacenamientoService: AlmacenamientoService,
    private apiService: ApiService
  ) {}

  iniciarEscuchaRed(): void {
    Network.addListener('networkStatusChange', async (status) => {
      if (status.connected) {
        await this.sincronizarTodo();
      }
    });
  }

  detenerEscuchaRed(): void {
    Network.removeAllListeners();
  }

  async sincronizarTodo(): Promise<void> {
    if (this.sincronizando) return;
    this.sincronizando = true;

    try {
      await this.sincronizarPosiciones();
      await this.sincronizarImagenes();
      await this.sincronizarHitos();
      await this.sincronizarEvidenciasFirestore();
    } catch (err) {
      console.error('❌ Error en sincronización:', err);
    } finally {
      this.sincronizando = false;
    }
  }

  // ── RF23 — Sincronizar posiciones pendientes ──
 private async sincronizarPosiciones(): Promise<void> {
  const posiciones = await this.almacenamientoService.obtenerPosicionesPendientes();

  if (posiciones.filter(p => !p.enviado).length === 0) return;

  for (let i = 0; i < posiciones.length; i++) {
    if (posiciones[i].enviado) continue;

    try {
      const recorridoRef = doc(firebaseDB, 'recorridos', posiciones[i].recorridoId);
      const recorridoSnap = await getDoc(recorridoRef);

      if (!recorridoSnap.exists() || !recorridoSnap.data()?.['idApiRecorrido']) {
        console.warn(`⚠️ Recorrido no válido — descartando posición`);
        await this.almacenamientoService.marcarPosicionComoEnviada(i);
        continue;
      }

      await this.apiService.guardarPosicionGPS(posiciones[i].recorridoId, {
        latitud: posiciones[i].latitud,
        longitud: posiciones[i].longitud,
        precision: posiciones[i].precision,
        fechaRegistro: new Date(posiciones[i].fechaRegistro)
      }).toPromise();

      await this.almacenamientoService.marcarPosicionComoEnviada(i);
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

  if (pendientes.length === 0) return;

  for (let i = 0; i < imagenes.length; i++) {
    if (imagenes[i].enviado) continue;

    try {
      const recorridoRef = doc(firebaseDB, 'recorridos', imagenes[i].recorridoId);
      const recorridoSnap = await getDoc(recorridoRef);

      if (!recorridoSnap.exists() || !recorridoSnap.data()?.['idApiRecorrido']) {
        console.warn(`⚠️ Recorrido no válido — descartando imagen`);
        await this.almacenamientoService.marcarImagenComoEnviada(i); 
        continue;
      }

      await this.apiService.guardarEvidencia(
        imagenes[i].recorridoId,
        imagenes[i].imagenBase64,
        null
      ).toPromise();

      await this.almacenamientoService.marcarImagenComoEnviada(i); 
    } catch (err) {
      console.warn('❌ Error sincronizando imagen:', err);
    }
  }

  await this.almacenamientoService.limpiarImagenesSincronizadas();
}

  // ── RF25 — Sincronizar hitos pendientes ──
private async sincronizarHitos(): Promise<void> {
  const hitos = await this.almacenamientoService.obtenerHitosPendientes();

  if (hitos.filter(h => !h.enviado).length === 0) return;

  for (let i = 0; i < hitos.length; i++) {
    if (hitos[i].enviado) continue;

    try {
      await this.apiService.guardarHitoFirestore(hitos[i]).toPromise();
      await this.almacenamientoService.marcarHitoComoEnviado(i);
    } catch (err) {
      console.warn('❌ Error sincronizando hito:', err);
    }
  }

  await this.almacenamientoService.limpiarHitosSincronizados();
}




// RF24 — Sincronizar evidencias de Firestore que no llegaron a la API
private async sincronizarEvidenciasFirestore(): Promise<void> {
  try {
    const evidenciasCollection = collection(firebaseDB, 'evidencias');
    const q = query(evidenciasCollection, where('posicionIdApi', '==', null));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return;

    for (const evidenciaDoc of snapshot.docs) {
      const evidencia = evidenciaDoc.data();
      const recorridoId = evidencia['recorridoId'];

      // Verificar que el recorrido tenga idApiRecorrido y no esté suspendido
      const recorridoRef = doc(firebaseDB, 'recorridos', recorridoId);
      const recorridoSnap = await getDoc(recorridoRef);

      if (!recorridoSnap.exists()) continue;

      const estado = recorridoSnap.data()?.['estado'];
      const idApiRecorrido = recorridoSnap.data()?.['idApiRecorrido'];

      if (!idApiRecorrido || estado === 'suspendido' || estado === 'finalizado') continue;

      const posicion = evidencia['latitud'] != null ? {
        latitud: evidencia['latitud'],
        longitud: evidencia['longitud'],
        precision: 0,
      } : null;

      if (!posicion) continue;

      try {
        await this.apiService.guardarEvidencia(
          recorridoId,
          evidencia['imagenBase64'],
          posicion
        ).toPromise();

        // Marcar como sincronizada en Firestore
        await updateDoc(doc(firebaseDB, 'evidencias', evidenciaDoc.id), {
          posicionIdApi: 'sincronizado',
        });

        console.log('✅ Evidencia Firestore sincronizada:', evidenciaDoc.id);
      } catch (err) {
        console.warn('❌ Error sincronizando evidencia Firestore:', err);
      }
    }
  } catch (err) {
    console.warn('❌ Error leyendo evidencias de Firestore:', err);
  }
}


  async hayConexion(): Promise<boolean> {
    const status = await Network.getStatus();
    return status.connected;
  }
}