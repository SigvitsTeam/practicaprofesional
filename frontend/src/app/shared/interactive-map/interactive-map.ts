import { Component, input, output } from '@angular/core';
import { Report } from '../../core/models';

export type MapMetric = 'total' | 'newCases' | 'controls' | 'alerts';

@Component({ selector: 'app-interactive-map', templateUrl: './interactive-map.html', styleUrl: './interactive-map.css' })
export class InteractiveMap {
  readonly reports = input.required<Report[]>();
  readonly level = input.required<'municipal' | 'regional'>();
  readonly metric = input.required<MapMetric>();
  readonly levelChange = output<'municipal' | 'regional'>();
  readonly reportSelected = output<Report>();

  metricValue(report: Report) { return report[this.metric()]; }
  markerLeft(index: number) { return 16 + (index % 4) * 22; }
  markerTop(index: number) { return 23 + Math.floor(index / 4) * 25; }
  metricLabel() {
    return ({ total: 'Casos totales', newCases: 'Casos nuevos', controls: 'Controles', alerts: 'Alertas' } as const)[this.metric()];
  }
}
