export interface Ruta {
  id?: string;
  perfil_id: string;
  nombre_ruta: string;
  color_hex?: string;
  shape?: string;
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