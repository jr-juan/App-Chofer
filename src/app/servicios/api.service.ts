import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of, throwError } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { environmentApi, environmentPerfilId } from '../../environments/environment';
import { firebaseAuth, firebaseDB } from './firebase.config';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
} from 'firebase/firestore';
import { Ruta, CrearRuta, Vehiculo, Calle, RespuestaAPI } from '../modelos/interfaces';

@Injectable({
  providedIn: 'root',
})
export class ApiService {

  private urlBase = environmentApi.apiUrl;
  readonly PERFIL_ID = environmentPerfilId.perfilId;

  constructor(private http: HttpClient) {}

  // ==================== RUTAS ====================

  obtenerRutasPorPerfil(perfilId: string): Observable<RespuestaAPI<Ruta[]>> {
    const user = firebaseAuth.currentUser;
    if (!user) return of({ data: [] });

    const rutasCollection = collection(firebaseDB, 'rutas');
    const q = query(rutasCollection, where('userId', '==', user.uid));

    return from(getDocs(q)).pipe(
      map((snapshot) => ({
        data: snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as Ruta)),
      }))
    );
  }

  obtenerRutaPorId(idFirestore: string): Observable<RespuestaAPI<Ruta>> {
    const user = firebaseAuth.currentUser;
    if (!user) return throwError(() => new Error('Usuario no autenticado'));

    const docRef = doc(firebaseDB, 'rutas', idFirestore);
    return from(getDoc(docRef)).pipe(
      map((docSnap) => {
        if (docSnap.exists() && docSnap.data()['userId'] === user.uid) {
          return { data: { id: docSnap.id, ...docSnap.data() } as Ruta };
        }
        throw new Error('Ruta no encontrada');
      })
    );
  }

  crearRuta(ruta: CrearRuta): Observable<any> {
    const user = firebaseAuth.currentUser;
    if (!user) return throwError(() => new Error('Usuario no autenticado'));

    const { perfil_id, ...rutaSinPerfil } = ruta;
    const { id, ...rutaLimpia } = rutaSinPerfil as any;

    return this.http.post<any>(`${this.urlBase}/rutas?perfil_id=${this.PERFIL_ID}`, rutaSinPerfil).pipe(
      switchMap((respuestaLucio) => {
        const idReal = respuestaLucio.data?.id;
        const rutasCollection = collection(firebaseDB, 'rutas');
        const rutaParaFirestore = { ...rutaLimpia, idApiLucio: idReal, userId: user.uid };
        return from(addDoc(rutasCollection, rutaParaFirestore));
      })
    );
  }

  eliminarRuta(idFirestore: string): Observable<void> {
    const user = firebaseAuth.currentUser;
    if (!user) return throwError(() => new Error('Usuario no autenticado'));

    const docRef = doc(firebaseDB, 'rutas', idFirestore);
    return from(getDoc(docRef)).pipe(
      switchMap((docSnap) => {
        if (docSnap.exists() && docSnap.data()['userId'] === user.uid) {
          return from(deleteDoc(docRef));
        }
        throw new Error('No tienes permiso para eliminar esta ruta');
      })
    );
  }

  // ==================== VEHÍCULOS ====================

  obtenerVehiculos(): Observable<RespuestaAPI<Vehiculo[]>> {
    const user = firebaseAuth.currentUser;
    if (!user) return of({ data: [] });

    const vehiculosCollection = collection(firebaseDB, 'vehiculos');
    const q = query(vehiculosCollection, where('userId', '==', user.uid));

    return from(getDocs(q)).pipe(
      map((snapshot) => ({
        data: snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Vehiculo)),
      }))
    );
  }

  crearVehiculo(vehiculo: Vehiculo): Observable<any> {
    const user = firebaseAuth.currentUser;
    if (!user) return throwError(() => new Error('Usuario no autenticado'));

    const vehiculoParaLucio = { ...vehiculo, perfil_id: this.PERFIL_ID };
    return this.http.post<any>(`${this.urlBase}/vehiculos`, vehiculoParaLucio).pipe(
      switchMap((respuestaDeLucio) => {
        const vehiculosCollection = collection(firebaseDB, 'vehiculos');
        const vehiculoParaFirestore = { ...vehiculo, idApiLucio: respuestaDeLucio.id, userId: user.uid };
        return from(addDoc(vehiculosCollection, vehiculoParaFirestore));
      })
    );
  }

  obtenerVehiculoPorId(idFirestore: string): Observable<Vehiculo> {
    const user = firebaseAuth.currentUser;
    if (!user) return throwError(() => new Error('Usuario no autenticado'));

    const docRef = doc(firebaseDB, 'vehiculos', idFirestore);
    return from(getDoc(docRef)).pipe(
      map((docSnap) => {
        if (docSnap.exists() && docSnap.data()['userId'] === user.uid) {
          return { id: docSnap.id, ...docSnap.data() } as Vehiculo;
        }
        throw new Error('Vehículo no encontrado o no tienes permiso');
      })
    );
  }

  actualizarVehiculo(idFirestore: string, datos: Vehiculo): Observable<any> {
    const user = firebaseAuth.currentUser;
    if (!user) return throwError(() => new Error('Usuario no autenticado'));

    const docRef = doc(firebaseDB, 'vehiculos', idFirestore);
    return from(getDoc(docRef)).pipe(
      switchMap((docSnap) => {
        if (!docSnap.exists() || docSnap.data()['userId'] !== user.uid) {
          throw new Error('Vehículo no encontrado o no tienes permiso');
        }
        const idApiLucio = docSnap.data()['idApiLucio'];
        return this.http
          .put<any>(`${this.urlBase}/vehiculos/${idApiLucio}?perfil_id=${this.PERFIL_ID}`, datos)
          .pipe(
            switchMap(() =>
              from(updateDoc(docRef, datos as { [key: string]: any }))
            )
          );
      })
    );
  }

  eliminarVehiculo(idFirestore: string): Observable<void> {
    const user = firebaseAuth.currentUser;
    if (!user) return throwError(() => new Error('Usuario no autenticado'));

    const docRef = doc(firebaseDB, 'vehiculos', idFirestore);
    return from(getDoc(docRef)).pipe(
      switchMap((docSnap) => {
        if (!docSnap.exists() || docSnap.data()['userId'] !== user.uid) {
          throw new Error('Vehículo no encontrado o no tienes permiso');
        }
        const idApiLucio = docSnap.data()['idApiLucio'];
        return this.http
          .delete<void>(`${this.urlBase}/vehiculos/${idApiLucio}?perfil_id=${this.PERFIL_ID}`)
          .pipe(
            switchMap(() => from(deleteDoc(docRef)))
          );
      })
    );
  }

  obtenerVehiculosDelChofer(choferId: string): Observable<RespuestaAPI<Vehiculo[]>> {
    const vehiculosCollection = collection(firebaseDB, 'vehiculos');
    const q = query(vehiculosCollection, where('choferAsignado', '==', choferId));

    return from(getDocs(q)).pipe(
      map((snapshot) => ({
        data: snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Vehiculo)),
      }))
    );
  }

  // ==================== CALLES ====================

  obtenerCalles(): Observable<RespuestaAPI<Calle[]>> {
    return this.http.get<RespuestaAPI<Calle[]>>(`${this.urlBase}/calles`);
  }

  obtenerCallePorId(calleId: string): Observable<RespuestaAPI<Calle>> {
    return this.http.get<RespuestaAPI<Calle>>(`${this.urlBase}/calles/${calleId}`);
  }
}