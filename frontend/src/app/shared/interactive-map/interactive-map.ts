import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  input,
  OnChanges,
  OnDestroy,
  output,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import type { LayerGroup, Map as LeafletMap, TileLayer, LatLngTuple } from 'leaflet';
import { Report } from '../../core/models';
import { RuntimeConfigService } from '../../core/runtime-config.service';
import { formatSmallCount } from '../../core/small-count';

export type MapMetric = 'total' | 'newCases' | 'controls' | 'alerts';
export type MapLevel = 'municipal' | 'regional' | 'national';

@Component({
  selector: 'app-interactive-map',
  templateUrl: './interactive-map.html',
  styleUrl: './interactive-map.css',
})
export class InteractiveMap implements AfterViewInit, OnChanges, OnDestroy {
  readonly reports = input.required<Report[]>();
  readonly level = input.required<MapLevel>();
  readonly metric = input.required<MapMetric>();
  readonly allowNational = input(false);
  readonly allowRegional = input(true);
  readonly allowMunicipal = input(true);
  readonly entityLabel = input('Establecimientos');
  readonly levelChange = output<MapLevel>();
  readonly reportSelected = output<Report>();
  private readonly platformId = inject(PLATFORM_ID);
  private readonly runtimeConfig = inject(RuntimeConfigService);
  private readonly mapHost = viewChild<ElementRef<HTMLDivElement>>('mapHost');
  private leaflet?: typeof import('leaflet');
  private map?: LeafletMap;
  private markerLayer?: LayerGroup;
  private tileLayer?: TileLayer;
  protected readonly mapError = signal('');
  protected readonly mapLoading = signal(true);

  async ngAfterViewInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      this.leaflet = await import('leaflet');
      this.initializeMap();
    } catch {
      this.mapLoading.set(false);
      this.mapError.set('No fue posible inicializar el mapa geográfico.');
    }
  }

  ngOnChanges() {
    this.refreshMarkers();
  }

  ngOnDestroy() {
    this.map?.remove();
    this.map = undefined;
  }

  get locatedReports() {
    return this.reports().filter((report) => this.hasCoordinates(report));
  }

  get missingCoordinateCount() {
    return this.reports().length - this.locatedReports.length;
  }

  metricValue(report: Report) {
    return report[this.metric()];
  }

  metricDisplay(report: Report) {
    return formatSmallCount(this.metricValue(report), this.runtimeConfig.maps.smallCountThreshold);
  }

  metricLabel() {
    return (
      {
        total: 'Casos totales',
        newCases: 'Casos nuevos',
        controls: 'Controles',
        alerts: 'Alertas',
      } as const
    )[this.metric()];
  }

  retryMap() {
    this.mapError.set('');
    this.mapLoading.set(true);
    this.configureBaseLayer();
  }

  private initializeMap() {
    const host = this.mapHost()?.nativeElement;
    const leaflet = this.leaflet;
    if (!host || !leaflet) return;
    this.map = leaflet.map(host, {
      attributionControl: true,
      preferCanvas: true,
      zoomControl: true,
      minZoom: 5,
      maxZoom: this.runtimeConfig.maps.maxZoom,
    });
    this.markerLayer = leaflet.layerGroup().addTo(this.map);
    this.configureBaseLayer();
    this.refreshMarkers();
    queueMicrotask(() => this.map?.invalidateSize());
  }

  private configureBaseLayer() {
    const map = this.map;
    const leaflet = this.leaflet;
    if (!map || !leaflet) return;
    this.tileLayer?.remove();
    let tileErrors = 0;
    this.tileLayer = leaflet.tileLayer(this.runtimeConfig.maps.tileUrl, {
      attribution: this.runtimeConfig.maps.attribution,
      maxZoom: this.runtimeConfig.maps.maxZoom,
      crossOrigin: true,
    });
    this.tileLayer.on('load', () => {
      this.mapLoading.set(false);
      this.mapError.set('');
    });
    this.tileLayer.on('tileerror', () => {
      tileErrors += 1;
      if (tileErrors >= 3) {
        this.mapLoading.set(false);
        this.mapError.set(
          'El proveedor cartográfico no respondió. Los indicadores siguen disponibles en el ranking.',
        );
      }
    });
    this.tileLayer.addTo(map);
  }

  private refreshMarkers() {
    const map = this.map;
    const leaflet = this.leaflet;
    const markerLayer = this.markerLayer;
    if (!map || !leaflet || !markerLayer) return;
    markerLayer.clearLayers();
    const located = this.locatedReports;
    for (const report of located) {
      const value = this.metricDisplay(report);
      const marker = leaflet.marker([report.latitude!, report.longitude!], {
        alt: `${report.name}: ${this.metricLabel()} ${value}`,
        title: report.name,
        keyboard: true,
        icon: leaflet.divIcon({
          className: 'sigvits-marker-shell',
          html: `<span class="sigvits-map-marker ${report.coordinatesValidated ? 'validated' : 'reference'}">${value}</span>`,
          iconAnchor: [18, 18],
          iconSize: [36, 36],
        }),
      });
      const tooltip = document.createElement('span');
      const title = document.createElement('strong');
      const detail = document.createElement('small');
      title.textContent = report.name;
      detail.textContent = `${this.metricLabel()}: ${value} · ${report.coordinatesValidated ? 'ubicación validada' : 'referencia pendiente de validación'}`;
      tooltip.append(title, detail);
      marker.bindTooltip(tooltip, { direction: 'top', offset: [0, -14] });
      marker.on('click', () => this.reportSelected.emit(report));
      marker.addTo(markerLayer);
    }
    this.fitMap(located);
  }

  private fitMap(located: Report[]) {
    const map = this.map;
    const leaflet = this.leaflet;
    if (!map || !leaflet) return;
    if (located.length) {
      const points = located.map((report) => [report.latitude!, report.longitude!] as LatLngTuple);
      map.fitBounds(leaflet.latLngBounds(points).pad(0.18), { maxZoom: 14, animate: false });
      return;
    }
    const defaults: Record<MapLevel, { center: LatLngTuple; zoom: number }> = {
      national: { center: [14.75, -86.5], zoom: 7 },
      regional: { center: [15.45, -87.85], zoom: 9 },
      municipal: { center: [15.82, -87.92], zoom: 12 },
    };
    const view = defaults[this.level()];
    map.setView(view.center, view.zoom, { animate: false });
  }

  private hasCoordinates(report: Report): boolean {
    return (
      Number.isFinite(report.latitude) &&
      Number.isFinite(report.longitude) &&
      report.latitude! >= -90 &&
      report.latitude! <= 90 &&
      report.longitude! >= -180 &&
      report.longitude! <= 180
    );
  }
}
