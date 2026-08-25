import { Component, input, output } from '@angular/core';
import { Report } from '../../core/models';

export type MapMetric = 'total' | 'newCases' | 'controls' | 'alerts';
export type MapLevel = 'municipal' | 'regional' | 'national';

@Component({
  selector: 'app-interactive-map',
  templateUrl: './interactive-map.html',
  styleUrl: './interactive-map.css',
})
export class InteractiveMap {
  readonly reports = input.required<Report[]>();
  readonly level = input.required<MapLevel>();
  readonly metric = input.required<MapMetric>();
  readonly allowNational = input(false);
  readonly allowRegional = input(true);
  readonly allowMunicipal = input(true);
  readonly entityLabel = input('Establecimientos');
  readonly levelChange = output<MapLevel>();
  readonly reportSelected = output<Report>();

  metricValue(report: Report) {
    return report[this.metric()];
  }
  markerLeft(report: Report, index: number) {
    if (!this.hasCoordinates(report) || this.level() !== 'municipal') return 16 + (index % 4) * 22;
    const bounds = this.coordinateBounds();
    return 10 + ((report.longitude! - bounds.minLongitude) / bounds.longitudeRange) * 76;
  }
  markerTop(report: Report, index: number) {
    if (!this.hasCoordinates(report) || this.level() !== 'municipal')
      return 23 + Math.floor(index / 4) * 25;
    const bounds = this.coordinateBounds();
    return 14 + ((bounds.maxLatitude - report.latitude!) / bounds.latitudeRange) * 68;
  }
  coordinateLabel(report: Report) {
    if (!this.hasCoordinates(report)) return 'Ubicación no disponible';
    return report.coordinatesValidated
      ? 'Coordenada puntual confirmada'
      : 'Referencia comunitaria pendiente de validación GPS';
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

  private hasCoordinates(report: Report): boolean {
    return Number.isFinite(report.latitude) && Number.isFinite(report.longitude);
  }

  private coordinateBounds() {
    const located = this.reports().filter((report) => this.hasCoordinates(report));
    const latitudes = located.map((report) => report.latitude!);
    const longitudes = located.map((report) => report.longitude!);
    const minLatitude = Math.min(...latitudes);
    const maxLatitude = Math.max(...latitudes);
    const minLongitude = Math.min(...longitudes);
    const maxLongitude = Math.max(...longitudes);
    return {
      maxLatitude,
      minLongitude,
      latitudeRange: Math.max(maxLatitude - minLatitude, 0.01),
      longitudeRange: Math.max(maxLongitude - minLongitude, 0.01),
    };
  }
}
