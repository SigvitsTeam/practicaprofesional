import { Component, output } from '@angular/core';
import { REPORTS } from '../../core/mock-data';
import { Report } from '../../core/models';
import { InteractiveMap, MapMetric } from '../../shared/interactive-map/interactive-map';

@Component({ selector: 'app-maps', imports: [InteractiveMap], templateUrl: './maps.html', styleUrl: './maps.css' })
export class Maps {
  readonly reportSelected = output<Report>();
  readonly notify = output<string>();
  protected readonly reports = REPORTS;
  protected mapLevel: 'municipal' | 'regional' = 'municipal';
  protected metric: MapMetric = 'total';

  get totalMetric() { return this.reports.reduce((sum, report) => sum + report[this.metric], 0); }
  get metricLabel() { return ({ total: 'Casos totales', newCases: 'Casos nuevos', controls: 'Controles', alerts: 'Alertas' } as const)[this.metric]; }
  setMetric(event: Event) { this.metric = (event.target as HTMLSelectElement).value as MapMetric; }
  resetFilters() { this.metric = 'total'; this.notify.emit('Filtros del mapa restablecidos.'); }
}
