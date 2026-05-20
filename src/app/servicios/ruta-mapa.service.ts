import { Injectable } from "@angular/core";

@Injectable({
  providedIn: "root",
})
export class RutaMapaService {
  private datos: any = null;

  setDatos(datos: any) {
    this.datos = datos;
  }

  getDatos() {
    return this.datos;
  }

  limpiar() {
    this.datos = null;
  }
}
