import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef,
  NgZone,
} from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { Subscription } from "rxjs";
import { GpsService } from "../../servicios/gps.service";
import { PosicionGPS } from "../../modelos/interfaces";
import * as mapboxgl from "mapbox-gl";
import { environment } from "../../../environments/environment";
import { RutaMapaService } from "src/app/servicios/ruta-mapa.service";

@Component({
  selector: "app-mapa",
  templateUrl: "./mapa.page.html",
  styleUrls: ["./mapa.page.css"],
})
export class MapaPage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild("mapContainer", { static: false })
  mapContainer!: ElementRef<HTMLDivElement>;

  private map?: mapboxgl.Map;
  private suscripcionGPS?: Subscription;

  cargando = true;
  nombreRuta = "";
  colorRuta = "#667eea";
  posicionActual: PosicionGPS | null = null;
  errorMapa = "";
  rutaShape = "";

  private rutaId = "";

  gpsActivoAlEntrar = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private gpsService: GpsService,
    private ngZone: NgZone,
    private rutaMapaService: RutaMapaService,
  ) {}

  ngOnInit() {
    this.rutaId = this.route.snapshot.paramMap.get("rutaId") || "";
    const datos = this.rutaMapaService.getDatos();

    if (datos?.shape) {
      this.nombreRuta = datos.nombre || "Ruta";
      this.colorRuta = datos.color || "#667eea";
      this.rutaShape = datos.shape;
      this.rutaMapaService.limpiar();
    } else {
      this.errorMapa = "No se pudieron cargar los datos de la ruta.";
    }
  }

  ngAfterViewInit() {
    if (!this.errorMapa) {
      this.inicializarMapa();
    }
  }

ionViewDidEnter() {
  if (this.map) {
    this.map.resize();
  }
}

ionViewWillLeave() {
  if (this.suscripcionGPS) {
    this.suscripcionGPS.unsubscribe();
  }
}

private inicializarMapa() {
  (mapboxgl as any).accessToken = (environment as any).mapboxToken;

  this.ngZone.runOutsideAngular(() => {
    try {
      this.map = new mapboxgl.Map({
        container: this.mapContainer.nativeElement,
        style: "mapbox://styles/mapbox/streets-v12",
        zoom: 13,
        attributionControl: false,
      });

      this.map.addControl(new mapboxgl.NavigationControl(), "top-right");

      this.map.on("load", () => {
        this.ngZone.run(async () => {
          this.map!.resize();
          if (this.rutaShape) {
            this.dibujarRuta(this.rutaShape, this.colorRuta);
          }
          this.cargando = false;
          await this.suscribirseGPS();
        });
      });
    } catch (err) {
      this.ngZone.run(() => {
        console.error("Error inicializando mapa:", err);
        this.errorMapa = "No se pudo inicializar el mapa.";
        this.cargando = false;
      });
    }
  });
}

private dibujarRuta(shape: string, color: string) {
  if (!this.map) return;
  try {
    const geometry = JSON.parse(shape);

    this.map.addSource("ruta-principal", {
      type: "geojson",
      data: { type: "Feature", properties: {}, geometry },
    });

    this.map.addLayer({
      id: "ruta-glow",
      type: "line",
      source: "ruta-principal",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": color,
        "line-width": 14,
        "line-opacity": 0.2,
        "line-blur": 6,
      },
    });

    this.map.addLayer({
      id: "ruta-linea",
      type: "line",
      source: "ruta-principal",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": color, "line-width": 4 },
    });

    const coords: [number, number][] = geometry.coordinates;
    if (coords?.length) {
      this.map.resize();
      const bounds = coords.reduce(
        (b, c) => b.extend(c),
        new mapboxgl.LngLatBounds(coords[0], coords[0]),
      );
      this.map.fitBounds(bounds, { padding: 60, duration: 1000 });
    }
  } catch (e) {
    console.error("Error dibujando ruta:", e);
  }
}

private async suscribirseGPS() {
  const posicionInicial = this.gpsService.getPosicionActual();
  if (posicionInicial) {
    this.posicionActual = posicionInicial;
    this.colocarMarcador(posicionInicial);
  }

  this.suscripcionGPS = this.gpsService.posicionActual$.subscribe((posicion) => {
    if (!this.map) return;
    this.ngZone.run(() => {
      this.posicionActual = posicion;
      if (posicion) {
        this.colocarMarcador(posicion);
      } else {
        // Limpiar marcador cuando se detiene el recorrido 
        if (this.map?.getSource('marcador-vehiculo')) {
          (this.map.getSource('marcador-vehiculo') as any).setData({
            type: 'FeatureCollection',
            features: []
          });
        }
      }
    });
  });
}

private colocarMarcador(posicion: PosicionGPS) {
  if (!this.map) return;

  const geojson: any = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [posicion.longitud, posicion.latitud]
      },
      properties: {}
    }]
  };

  if (this.map.getSource('marcador-vehiculo')) {
    (this.map.getSource('marcador-vehiculo') as any).setData(geojson);
  } else {
    this.map.addSource('marcador-vehiculo', { type: 'geojson', data: geojson });

    this.map.addLayer({
      id: 'marcador-pulso',
      type: 'circle',
      source: 'marcador-vehiculo',
      paint: {
        'circle-radius': 18,
        'circle-color': '#3498db',
        'circle-opacity': 0.3,
        'circle-stroke-width': 0,
      }
    });

    this.map.addLayer({
      id: 'marcador-punto',
      type: 'circle',
      source: 'marcador-vehiculo',
      paint: {
        'circle-radius': 10,
        'circle-color': '#3498db',
        'circle-opacity': 1,
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
      }
    });
  }
}

centrarEnVehiculo() {
  if (!this.map || !this.posicionActual) return;
  this.map.flyTo({
    center: [this.posicionActual.longitud, this.posicionActual.latitud],
    zoom: 15,
    duration: 800,
  });
}



  volver() {
    this.router.navigate(["/inicio"]);
  }

  ngOnDestroy() {
    this.suscripcionGPS?.unsubscribe();
    this.map?.remove();
  }
}
