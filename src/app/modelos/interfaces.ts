export interface Ruta {
  id?: string;
  perfil_id: string;
  nombre_ruta: string;
  color_hex?: string;
  shape?: string;
  choferAsignado?: string | null;
  idApiLucio?: string | null;
}

export interface CrearRuta {
  nombre_ruta: string;
  perfil_id: string;
  color_hex?: string;
  shape?: string;
  calles_ids?: string[];
}

export interface Vehiculo {
  id?: string;
  perfil_id: string;
  placa: string;
  marca: string | null;
  modelo: string | null;
  activo: boolean;
  choferAsignado?: string | null;
  idApiLucio?: string | null;
}

export interface Calle {
  id: string;
  nombre: string;
  shape: string;
}

export interface RespuestaAPI<T> {
  data?: T;
  message?: string;
  error?: string;
}

export interface Recorrido {
  id?: string;
  choferId: string;
  vehiculoId: string;
  rutaId: string;
  estado: "activo" | "suspendido" | "finalizado";
  fechaInicio: any;
  fechaFin: any;
  idApiRecorrido?: string | null;
}

export interface PosicionGPS {
  latitud: number;
  longitud: number;
  precision: number;
  fechaRegistro?: Date;
}

export interface Hito {
  recorridoId: string;
  kilometro: number;
  latitud: number;
  longitud: number;
  fechaRegistro: Date;
  imagenBase64: string; // RF17 — viene de Jazmin también
  enviado: boolean; // para modo offline (RF21/RF22)
}
