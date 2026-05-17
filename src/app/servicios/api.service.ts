import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, from, of, throwError } from "rxjs";
import { map, switchMap, catchError } from "rxjs/operators";
import {
  environmentApi,
  environmentPerfilId,
} from "../../environments/environment";
import { firebaseAuth, firebaseDB } from "./firebase.config";
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
} from "firebase/firestore";
import {
  Ruta,
  CrearRuta,
  Vehiculo,
  Calle,
  RespuestaAPI,
  PosicionGPS,
  Hito,
} from "../modelos/interfaces";
import { AlmacenamientoService } from "./almacenamiento.service";

@Injectable({
  providedIn: "root",
})
export class ApiService {
  private urlBase = environmentApi.apiUrl;
  readonly PERFIL_ID = environmentPerfilId.perfilId;

  constructor(
    private http: HttpClient,
    private almacenamientoService: AlmacenamientoService,
  ) {}

  // ==================== RUTAS ====================

  obtenerRutasPorPerfil(perfilId: string): Observable<RespuestaAPI<Ruta[]>> {
    const user = firebaseAuth.currentUser;
    if (!user) return of({ data: [] });

    const rutasCollection = collection(firebaseDB, "rutas");
    const q = query(rutasCollection, where("userId", "==", user.uid));

    return from(getDocs(q)).pipe(
      map((snapshot) => ({
        data: snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as Ruta),
      })),
    );
  }

  obtenerRutaPorId(idFirestore: string): Observable<RespuestaAPI<Ruta>> {
    const user = firebaseAuth.currentUser;
    if (!user) return throwError(() => new Error("Usuario no autenticado"));

    const docRef = doc(firebaseDB, "rutas", idFirestore);
    return from(getDoc(docRef)).pipe(
      map((docSnap) => {
        if (docSnap.exists() && docSnap.data()["userId"] === user.uid) {
          return { data: { id: docSnap.id, ...docSnap.data() } as Ruta };
        }
        throw new Error("Ruta no encontrada");
      }),
    );
  }

  obtenerRutasDelChofer(choferId: string): Observable<RespuestaAPI<Ruta[]>> {
    const rutasCollection = collection(firebaseDB, "rutas");
    const q = query(rutasCollection, where("choferAsignado", "==", choferId));

    return from(getDocs(q)).pipe(
      map((snapshot) => ({
        data: snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Ruta),
      })),
    );
  }

  crearRuta(ruta: CrearRuta): Observable<any> {
    const user = firebaseAuth.currentUser;
    if (!user) return throwError(() => new Error("Usuario no autenticado"));

    const { perfil_id, ...rutaSinPerfil } = ruta;
    const { id, ...rutaLimpia } = rutaSinPerfil as any;

    return this.http
      .post<any>(
        `${this.urlBase}/rutas?perfil_id=${this.PERFIL_ID}`,
        rutaSinPerfil,
      )
      .pipe(
        switchMap((respuestaLucio) => {
          const idReal = respuestaLucio.data?.id;
          const rutasCollection = collection(firebaseDB, "rutas");
          const rutaParaFirestore = {
            ...rutaLimpia,
            idApiLucio: idReal,
            userId: user.uid,
          };
          return from(addDoc(rutasCollection, rutaParaFirestore));
        }),
      );
  }

  eliminarRuta(idFirestore: string): Observable<void> {
    const user = firebaseAuth.currentUser;
    if (!user) return throwError(() => new Error("Usuario no autenticado"));

    const docRef = doc(firebaseDB, "rutas", idFirestore);
    return from(getDoc(docRef)).pipe(
      switchMap((docSnap) => {
        if (docSnap.exists() && docSnap.data()["userId"] === user.uid) {
          return from(deleteDoc(docRef));
        }
        throw new Error("No tienes permiso para eliminar esta ruta");
      }),
    );
  }

  // ==================== VEHÍCULOS ====================

  obtenerVehiculos(): Observable<RespuestaAPI<Vehiculo[]>> {
    const user = firebaseAuth.currentUser;
    if (!user) return of({ data: [] });

    const vehiculosCollection = collection(firebaseDB, "vehiculos");
    const q = query(vehiculosCollection, where("userId", "==", user.uid));

    return from(getDocs(q)).pipe(
      map((snapshot) => ({
        data: snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Vehiculo),
      })),
    );
  }

  crearVehiculo(vehiculo: Vehiculo): Observable<any> {
    const user = firebaseAuth.currentUser;
    if (!user) return throwError(() => new Error("Usuario no autenticado"));

    const vehiculoParaLucio = { ...vehiculo, perfil_id: this.PERFIL_ID };
    return this.http
      .post<any>(`${this.urlBase}/vehiculos`, vehiculoParaLucio)
      .pipe(
        switchMap((respuestaDeLucio) => {
          const vehiculosCollection = collection(firebaseDB, "vehiculos");
          const vehiculoParaFirestore = {
            ...vehiculo,
            idApiLucio: respuestaDeLucio.id,
            userId: user.uid,
          };
          return from(addDoc(vehiculosCollection, vehiculoParaFirestore));
        }),
      );
  }

  obtenerVehiculoPorId(idFirestore: string): Observable<Vehiculo> {
    const user = firebaseAuth.currentUser;
    if (!user) return throwError(() => new Error("Usuario no autenticado"));

    const docRef = doc(firebaseDB, "vehiculos", idFirestore);
    return from(getDoc(docRef)).pipe(
      map((docSnap) => {
        if (docSnap.exists() && docSnap.data()["userId"] === user.uid) {
          return { id: docSnap.id, ...docSnap.data() } as Vehiculo;
        }
        throw new Error("Vehículo no encontrado o no tienes permiso");
      }),
    );
  }

  actualizarVehiculo(idFirestore: string, datos: Vehiculo): Observable<any> {
    const user = firebaseAuth.currentUser;
    if (!user) return throwError(() => new Error("Usuario no autenticado"));

    const docRef = doc(firebaseDB, "vehiculos", idFirestore);
    return from(getDoc(docRef)).pipe(
      switchMap((docSnap) => {
        if (!docSnap.exists() || docSnap.data()["userId"] !== user.uid) {
          throw new Error("Vehículo no encontrado o no tienes permiso");
        }
        const idApiLucio = docSnap.data()["idApiLucio"];
        return this.http
          .put<any>(
            `${this.urlBase}/vehiculos/${idApiLucio}?perfil_id=${this.PERFIL_ID}`,
            datos,
          )
          .pipe(
            switchMap(() =>
              from(updateDoc(docRef, datos as { [key: string]: any })),
            ),
          );
      }),
    );
  }

  eliminarVehiculo(idFirestore: string): Observable<void> {
    const user = firebaseAuth.currentUser;
    if (!user) return throwError(() => new Error("Usuario no autenticado"));

    const docRef = doc(firebaseDB, "vehiculos", idFirestore);
    return from(getDoc(docRef)).pipe(
      switchMap((docSnap) => {
        if (!docSnap.exists() || docSnap.data()["userId"] !== user.uid) {
          throw new Error("Vehículo no encontrado o no tienes permiso");
        }
        const idApiLucio = docSnap.data()["idApiLucio"];
        return this.http
          .delete<void>(
            `${this.urlBase}/vehiculos/${idApiLucio}?perfil_id=${this.PERFIL_ID}`,
          )
          .pipe(switchMap(() => from(deleteDoc(docRef))));
      }),
    );
  }

  obtenerVehiculosDelChofer(
    choferId: string,
  ): Observable<RespuestaAPI<Vehiculo[]>> {
    const vehiculosCollection = collection(firebaseDB, "vehiculos");
    const q = query(
      vehiculosCollection,
      where("choferAsignado", "==", choferId),
    );

    return from(getDocs(q)).pipe(
      map((snapshot) => ({
        data: snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Vehiculo),
      })),
    );
  }

  // ==================== CALLES ====================

  obtenerCalles(): Observable<RespuestaAPI<Calle[]>> {
    return this.http.get<RespuestaAPI<Calle[]>>(`${this.urlBase}/calles`);
  }

  obtenerCallePorId(calleId: string): Observable<RespuestaAPI<Calle>> {
    return this.http.get<RespuestaAPI<Calle>>(
      `${this.urlBase}/calles/${calleId}`,
    );
  }

  // ==================== RECORRIDOS ====================
  obtenerRecorridoActivo(choferId: string): Observable<any> {
    const recorridosCollection = collection(firebaseDB, "recorridos");
    const q = query(
      recorridosCollection,
      where("choferId", "==", choferId),
      where("estado", "==", "activo"),
    );

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        if (snapshot.empty) return null;
        const d = snapshot.docs[0];
        return { id: d.id, ...d.data() };
      }),
    );
  }

  iniciarRecorrido(
    choferId: string,
    vehiculoId: string,
    rutaId: string,
  ): Observable<string> {
    const recorridosCollection = collection(firebaseDB, "recorridos");
    const recorrido = {
      choferId,
      vehiculoId,
      rutaId,
      estado: "activo",
      fechaInicio: new Date(),
      fechaFin: null,
      idApiRecorrido: null,
    };

    return from(addDoc(recorridosCollection, recorrido)).pipe(
      switchMap((docRef) => {
        // Obtener idApiLucio de vehículo y ruta en paralelo
        const vehiculoRef = doc(firebaseDB, "vehiculos", vehiculoId);
        const rutaRef = doc(firebaseDB, "rutas", rutaId);

        return from(Promise.all([getDoc(vehiculoRef), getDoc(rutaRef)])).pipe(
          switchMap(([vehiculoSnap, rutaSnap]) => {
            const idApiVehiculo = vehiculoSnap.data()?.["idApiLucio"];
            const idApiRuta = rutaSnap.data()?.["idApiLucio"];

            if (!idApiVehiculo || !idApiRuta) {
              console.warn("No se encontraron idApiLucio de vehículo o ruta");
              return of(docRef.id);
            }

            const payload = {
              ruta_id: idApiRuta,
              vehiculo_id: idApiVehiculo,
              perfil_id: this.PERFIL_ID,
            };

            return this.http
              .post<any>(`${this.urlBase}/recorridos/iniciar`, payload)
              .pipe(
                switchMap((respuesta) => {
                  const idApiRecorrido = respuesta?.data?.id ?? null;
                  return from(updateDoc(docRef, { idApiRecorrido })).pipe(
                    map(() => docRef.id),
                  );
                }),
                catchError((err) => {
                  return of(docRef.id);
                }),
              );
          }),
        );
      }),
    );
  }

  guardarPosicionGPS(
    recorridoId: string,
    posicion: PosicionGPS,
  ): Observable<string | null> {
    const posicionesCollection = collection(firebaseDB, "posiciones");
    const datos = {
      recorridoId,
      latitud: posicion.latitud,
      longitud: posicion.longitud,
      precision: posicion.precision,
      fechaRegistro: new Date(),
      posicionIdApi: null, // se llenará si la API responde
    };

    return from(addDoc(posicionesCollection, datos)).pipe(
      switchMap((docRef) => {
        // Obtener el idApiRecorrido desde Firestore
        const recorridoRef = doc(firebaseDB, "recorridos", recorridoId);
        return from(getDoc(recorridoRef)).pipe(
          switchMap((recorridoSnap) => {
            const idApiRecorrido = recorridoSnap.data()?.["idApiRecorrido"];
            if (!idApiRecorrido) {
              // Sin id de API, guardamos solo en Firestore
              return of(null);
            }
            const payload = {
              lat: posicion.latitud,
              lon: posicion.longitud,
              perfil_id: this.PERFIL_ID,
            };
            return this.http
              .post<any>(
                `${this.urlBase}/recorridos/${idApiRecorrido}/posiciones`,
                payload,
              )
              .pipe(
                switchMap((respuesta) => {
                  const posicionIdApi = respuesta?.data?.id ?? null;
                  return from(updateDoc(docRef, { posicionIdApi })).pipe(
                    map(() => posicionIdApi as string | null),
                  );
                }),
                catchError((err) => {
                  console.warn(
                    "API profe no disponible al guardar posición:",
                    err,
                  );
                  // RF19/RF20 — guardar local para sincronizar después
                  this.almacenamientoService.guardarPosicionPendiente(
                    recorridoId,
                    posicion,
                  );
                  return of(null);
                }),
              );
          }),
        );
      }),
    );
  }

  finalizarRecorrido(recorridoId: string): Observable<void> {
    const docRef = doc(firebaseDB, "recorridos", recorridoId);

    return from(getDoc(docRef)).pipe(
      switchMap((docSnap) => {
        const idApiRecorrido = docSnap.data()?.["idApiRecorrido"];
        // Actualizar Firestore siempre
        const actualizarFirestore = from(
          updateDoc(docRef, {
            estado: "finalizado",
            fechaFin: new Date(),
          }),
        ).pipe(map(() => void 0));

        if (!idApiRecorrido) return actualizarFirestore;

        // Llamar API del profe y luego actualizar Firestore
        return this.http
          .post<any>(
            `${this.urlBase}/recorridos/${idApiRecorrido}/finalizar`,
            {},
          )
          .pipe(
            switchMap(() => actualizarFirestore),
            catchError((err) => {
              console.warn(
                "API profe no disponible al finalizar recorrido:",
                err,
              );
              return actualizarFirestore;
            }),
          );
      }),
    );
  }

  // ==================== HITOS ====================

  enviarHito(hito: Hito): Observable<any> {
    const payload = {
      recorrido_id: hito.recorridoId,
      kilometro: hito.kilometro,
      latitud: hito.latitud,
      longitud: hito.longitud,
      fecha_registro: hito.fechaRegistro,
      imagen: hito.imagenBase64,
      perfil_id: this.PERFIL_ID,
    };

    return this.http.post<any>(`${this.urlBase}/hitos`, payload);
  }

  guardarHitoFirestore(hito: Hito): Observable<void> {
    const hitosCollection = collection(firebaseDB, "hitos");
    const datos = {
      recorridoId: hito.recorridoId,
      kilometro: hito.kilometro,
      latitud: hito.latitud,
      longitud: hito.longitud,
      fechaRegistro: hito.fechaRegistro,
      imagenBase64: hito.imagenBase64,
      enviado: hito.enviado,
    };
    return from(addDoc(hitosCollection, datos)).pipe(map(() => void 0));
  }

  // ==================== EVIDENCIAS ====================

  guardarEvidencia(
    recorridoId: string,
    imagenBase64: string,
    posicion: PosicionGPS | null,
  ): Observable<void> {
    const evidenciasCollection = collection(firebaseDB, "evidencias");
    const datos = {
      recorridoId,
      imagenBase64,
      latitud: posicion?.latitud ?? null,
      longitud: posicion?.longitud ?? null,
      fechaRegistro: new Date(),
    };

    return from(addDoc(evidenciasCollection, datos)).pipe(
      switchMap((docRef) => {
        console.log("📦 Evidencia guardada en Firestore, id:", docRef.id);

        const recorridoRef = doc(firebaseDB, "recorridos", recorridoId);
        return from(getDoc(recorridoRef)).pipe(
          switchMap((recorridoSnap) => {
            const idApiRecorrido = recorridoSnap.data()?.["idApiRecorrido"];
            console.log("🔑 idApiRecorrido encontrado:", idApiRecorrido);

            if (!idApiRecorrido || !posicion) {
              console.warn(
                "⚠️ Sin idApiRecorrido o posición — solo se guardó en Firestore",
              );
              return of(void 0);
            }

            const payloadPos = {
              lat: posicion.latitud,
              lon: posicion.longitud,
              perfil_id: this.PERFIL_ID,
            };
            console.log("📡 Enviando posición a API profe:", payloadPos);

            return this.http
              .post<any>(
                `${this.urlBase}/recorridos/${idApiRecorrido}/posiciones`,
                payloadPos,
              )
              .pipe(
                switchMap((respuestaPos) => {
                  console.log(
                    "✅ Posición registrada en API profe:",
                    respuestaPos,
                  );
                  const posicionId = respuestaPos?.data?.id;
                  console.log("🔑 posicionId para imagen:", posicionId);

                  if (!posicionId) {
                    console.warn(
                      "⚠️ No se obtuvo posicionId — imagen no se sube",
                    );
                    return of(void 0);
                  }

                  const payloadImg = { imagen_base64: imagenBase64 };
                  console.log("🖼️ Subiendo imagen a posición:", posicionId);

                  return this.http
                    .post<any>(
                      `${this.urlBase}/recorridos/posiciones/${posicionId}/imagen`,
                      payloadImg,
                    )
                    .pipe(
                      map((r) => {
                        console.log("✅ Imagen subida correctamente:", r);
                        return void 0;
                      }),
                      catchError((err) => {
                        console.warn("❌ Error subiendo imagen a API:", err);
                        return of(void 0);
                      }),
                    );
                }),
                catchError((err) => {
                  console.warn(
                    "❌ Error registrando posición para evidencia en API:",
                    err,
                  );
                  return of(void 0);
                }),
              );
          }),
        );
      }),
      map(() => void 0),
    );
  }
}
