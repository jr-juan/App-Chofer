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

    const qActivo = query(
      recorridosCollection,
      where("choferId", "==", choferId),
      where("estado", "==", "activo"),
    );
    const qSuspendido = query(
      recorridosCollection,
      where("choferId", "==", choferId),
      where("estado", "==", "suspendido"),
    );

    return from(Promise.all([getDocs(qActivo), getDocs(qSuspendido)])).pipe(
      map(([snapActivo, snapSuspendido]) => {
        if (!snapActivo.empty) {
          const d = snapActivo.docs[0];
          return { id: d.id, ...d.data() };
        }
        if (!snapSuspendido.empty) {
          const d = snapSuspendido.docs[0];
          return { id: d.id, ...d.data() };
        }
        return null;
      }),
    );
  }

  suspenderRecorrido(recorridoId: string): Observable<void> {
    const docRef = doc(firebaseDB, "recorridos", recorridoId);
    return from(
      updateDoc(docRef, {
        estado: "suspendido",
        fechaSuspension: new Date(),
      }),
    ).pipe(map(() => void 0));
  }

  verificarYSuspenderRecorrido(recorrido: any): Observable<boolean> {
    if (!recorrido?.id || recorrido.estado !== "activo") {
      return of(false);
    }
    const fechaInicio: Date =
      recorrido.fechaInicio?.toDate?.() ?? new Date(recorrido.fechaInicio);
    const horasTranscurridas =
      (new Date().getTime() - fechaInicio.getTime()) / (1000 * 60 * 60);

    /*  Por si quiero motrar el mensaje de 24 horas suspendido en 5 segundos
      const segundosTranscurridos = (new Date().getTime() - fechaInicio.getTime()) / 1000;
     if (segundosTranscurridos >= 5) {
        */
    if (horasTranscurridas >= 24) {
      return this.suspenderRecorrido(recorrido.id).pipe(map(() => true));
    }
    return of(false);
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
                  const idApiRecorrido =
                    respuesta?.id ?? respuesta?.data?.id ?? null;
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
      posicionIdApi: null,
    };

    return from(addDoc(posicionesCollection, datos)).pipe(
      switchMap((docRef) => {
        const recorridoRef = doc(firebaseDB, "recorridos", recorridoId);
        return from(getDoc(recorridoRef)).pipe(
          switchMap((recorridoSnap) => {
            const idApiRecorrido = recorridoSnap.data()?.["idApiRecorrido"];
            const estado = recorridoSnap.data()?.["estado"];

            // RF29 — Recorrido suspendido: no enviar a la API
            if (estado === "suspendido") {
              console.warn(
                "⛔ Recorrido suspendido — posición no enviada a la API",
              );
              this.almacenamientoService.guardarPosicionPendiente(
                recorridoId,
                posicion,
              );
              return of(null);
            }
            if (!idApiRecorrido) {
              this.almacenamientoService.guardarPosicionPendiente(
                recorridoId,
                posicion,
              );
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
                  const posicionIdApi =
                    respuesta?.id ?? respuesta?.data?.id ?? null;
                  return from(updateDoc(docRef, { posicionIdApi })).pipe(
                    map(() => posicionIdApi as string | null),
                  );
                }),
                catchError((err) => {
                  console.warn("API no disponible al guardar posición:", err);
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
          .post<any>(`${this.urlBase}/recorridos/${idApiRecorrido}/finalizar`, {
            perfil_id: this.PERFIL_ID,
          })
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

  private enviarPosicionEImagen(
    idApiRecorrido: string,
    posicion: PosicionGPS,
    imagenBase64: string,
  ): Observable<void> {
    console.log("🖼️ Primeros chars base64:", imagenBase64.substring(0, 50));
    console.log("🖼️ Tamaño base64:", imagenBase64.length);
    const payloadPos = {
      lat: posicion.latitud,
      lon: posicion.longitud,
      perfil_id: this.PERFIL_ID,
    };

    return this.http
      .post<any>(
        `${this.urlBase}/recorridos/${idApiRecorrido}/posiciones`,
        payloadPos,
      )
      .pipe(
        switchMap((respuestaPos) => {
          const posicionId = respuestaPos?.id ?? respuestaPos?.data?.id ?? null;

          if (!posicionId) {
            console.warn("⚠️ No se obtuvo posicionId — imagen no se sube");
            return of(void 0);
          }

          return this.http
            .post<any>(
              `${this.urlBase}/recorridos/posiciones/${posicionId}/imagen`,
              { imagen_base64: imagenBase64 },
            )
            .pipe(
              map(() => void 0),
              catchError((err) => {
                console.warn("❌ Error subiendo imagen status:", err?.status);
                console.warn(
                  "❌ Error subiendo imagen mensaje:",
                  JSON.stringify(err?.error),
                );
                return of(void 0);
              }),
            );
        }),
        catchError((err) => {
          console.warn("❌ Error registrando posición para evidencia:", err);
          return of(void 0);
        }),
      );
  }

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
      switchMap(() => {
        const recorridoRef = doc(firebaseDB, "recorridos", recorridoId);

        const intentarEnvio = (intento: number): Observable<void> =>
          from(getDoc(recorridoRef)).pipe(
            switchMap((recorridoSnap) => {
              const idApiRecorrido = recorridoSnap.data()?.["idApiRecorrido"];
              const estado = recorridoSnap.data()?.["estado"];

              // RF29 — Recorrido suspendido: no enviar a la API
              if (estado === "suspendido") {
                console.warn(
                  "⛔ Recorrido suspendido — evidencia no enviada a la API",
                );
                return of(void 0);
              }

              if (!idApiRecorrido) {
                if (intento < 3) {
                  // Reintentar hasta 3 veces con 3s de espera
                  return from(
                    new Promise<void>((resolve) => setTimeout(resolve, 3000)),
                  ).pipe(switchMap(() => intentarEnvio(intento + 1)));
                }
                console.warn(
                  "⚠️ idApiRecorrido no llegó tras reintentos — solo Firestore",
                );
                return of(void 0);
              }

              if (!posicion) {
                console.warn("⚠️ Sin posición — solo Firestore");
                return of(void 0);
              }

              return this.enviarPosicionEImagen(
                idApiRecorrido,
                posicion,
                imagenBase64,
              );
            }),
          );

        return intentarEnvio(1);
      }),
      map(() => void 0),
    );
  }
}
