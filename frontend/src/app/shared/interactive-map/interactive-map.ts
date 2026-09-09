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
import type {
  LayerGroup,
  LeafletKeyboardEvent,
  Map as LeafletMap,
  TileLayer,
  LatLngTuple,
} from 'leaflet';
import { Report } from '../../core/models';
import { RuntimeConfigService } from '../../core/runtime-config.service';
import { formatSmallCount, formatSuppressedCount } from '../../core/small-count';

export type MapMetric = 'total' | 'newCases' | 'controls' | 'alerts';
export type MapLevel = 'municipal' | 'regional' | 'national';
type LeafletApi = typeof import('leaflet');
const MIN_MAP_ZOOM = 5;
const TILE_ERROR_LIMIT = 3;

/** Angular's production build wraps Leaflet's CommonJS export under `default`. */
export function resolveLeafletApi(module: LeafletApi | { default: LeafletApi }): LeafletApi {
  return 'default' in module ? module.default : module;
}

export function tileLoadHasFailed(tileErrors: number, loadedTiles: number): boolean {
  return tileErrors >= TILE_ERROR_LIMIT || (tileErrors > 0 && loadedTiles === 0);
}

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
  readonly entityLabel = input('Establecimientos');
  readonly regionLabel = input('Región autorizada');
  readonly municipalityLabel = input('Municipio autorizado');
  readonly levelChange = output<MapLevel>();
  readonly reportSelected = output<Report>();
  private readonly platformId = inject(PLATFORM_ID);
  private readonly runtimeConfig = inject(RuntimeConfigService);
  private readonly mapHost = viewChild<ElementRef<HTMLDivElement>>('mapHost');
  private leaflet?: LeafletApi;
  private map?: LeafletMap;
  private markerLayer?: LayerGroup;
  private tileLayer?: TileLayer;
  private tileLoadTimeout?: ReturnType<typeof setTimeout>;
  private destroyed = false;
  protected readonly mapError = signal('');
  protected readonly mapLoading = signal(true);

  async ngAfterViewInit() {
    await this.loadLeaflet();
  }

  private async loadLeaflet() {
    if (!isPlatformBrowser(this.platformId) || this.destroyed) return;
    try {
      this.leaflet = resolveLeafletApi(
        (await import('leaflet')) as LeafletApi | { default: LeafletApi },
      );
      if (this.destroyed) return;
      this.initializeMap();
    } catch {
      this.clearTileLoadTimeout();
      this.map?.remove();
      this.map = undefined;
      this.markerLayer = undefined;
      this.tileLayer = undefined;
      this.mapLoading.set(false);
      this.mapError.set('No fue posible inicializar el mapa geográfico.');
    }
  }

  ngOnChanges() {
    this.refreshMarkers();
  }

  ngOnDestroy() {
    this.destroyed = true;
    this.clearTileLoadTimeout();
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
    const suppressed = Boolean(report.suppressedMetrics?.includes(this.metric()));
    if (report.complementarySuppressedMetrics?.includes(this.metric())) return 'Protegido';
    if (suppressed)
      return formatSuppressedCount(
        this.metricValue(report),
        report.smallCountThreshold ?? this.runtimeConfig.maps.smallCountThreshold,
        true,
      );
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
    if (!this.map) {
      void this.loadLeaflet();
      return;
    }
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
      minZoom: MIN_MAP_ZOOM,
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
    const previousLayer = this.tileLayer;
    this.tileLayer = undefined;
    previousLayer?.remove();
    let tileErrors = 0;
    let loadedTiles = 0;
    this.tileLayer = leaflet.tileLayer(this.runtimeConfig.maps.tileUrl, {
      attribution: this.runtimeConfig.maps.attribution,
      maxZoom: this.runtimeConfig.maps.maxZoom,
      crossOrigin: true,
    });
    const currentLayer = this.tileLayer;
    const startLoadCycle = () => {
      if (this.tileLayer !== currentLayer || this.destroyed) return;
      tileErrors = 0;
      loadedTiles = 0;
      this.mapError.set('');
      this.mapLoading.set(true);
      this.clearTileLoadTimeout();
      this.tileLoadTimeout = setTimeout(() => {
        if (this.tileLayer !== currentLayer || !this.mapLoading() || this.destroyed) return;
        this.mapLoading.set(false);
        this.mapError.set(
          'El proveedor cartográfico tardó demasiado en responder. Los indicadores siguen disponibles en el ranking.',
        );
      }, 10_000);
    };
    this.tileLayer.on('loading', startLoadCycle);
    this.tileLayer.on('tileload', () => {
      if (this.tileLayer !== currentLayer || this.destroyed) return;
      loadedTiles += 1;
    });
    this.tileLayer.on('load', () => {
      if (this.tileLayer !== currentLayer || this.destroyed) return;
      this.clearTileLoadTimeout();
      this.mapLoading.set(false);
      this.mapError.set(
        tileLoadHasFailed(tileErrors, loadedTiles)
          ? 'El proveedor cartográfico no respondió. Los indicadores siguen disponibles en el ranking.'
          : '',
      );
    });
    this.tileLayer.on('tileerror', () => {
      if (this.tileLayer !== currentLayer || this.destroyed) return;
      tileErrors += 1;
      if (tileErrors >= TILE_ERROR_LIMIT) {
        this.clearTileLoadTimeout();
        this.mapLoading.set(false);
        this.mapError.set(
          'El proveedor cartográfico no respondió. Los indicadores siguen disponibles en el ranking.',
        );
      }
    });
    startLoadCycle();
    this.tileLayer.addTo(map);
  }

  private clearTileLoadTimeout() {
    if (this.tileLoadTimeout !== undefined) clearTimeout(this.tileLoadTimeout);
    this.tileLoadTimeout = undefined;
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
      const markerLabel = `${report.name}: ${this.metricLabel()} ${value}`;
      const marker = leaflet.marker([report.latitude!, report.longitude!], {
        alt: markerLabel,
        title: markerLabel,
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
      const selectReport = () => this.reportSelected.emit(report);
      marker.on('click', selectReport);
      marker.on('keydown', (event: LeafletKeyboardEvent) => {
        if (!['Enter', ' ', 'Spacebar'].includes(event.originalEvent.key)) return;
        event.originalEvent.preventDefault();
        selectReport();
      });
      marker.on('add', () => marker.getElement()?.setAttribute('aria-label', markerLabel));
      marker.addTo(markerLayer);
      marker.getElement()?.setAttribute('aria-label', markerLabel);
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

  protected hasCoordinates(report: Report): boolean {
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
