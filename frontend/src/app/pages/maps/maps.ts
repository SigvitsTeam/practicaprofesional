import { Component, inject, output } from '@angular/core';
import { REPORTS } from '../../core/mock-data';
import { Report } from '../../core/models';
import { RoleContext } from '../../core/role-context';
import { InteractiveMap, MapMetric } from '../../shared/interactive-map/interactive-map';

@Component({ selector: 'app-maps', imports: [InteractiveMap], templateUrl: './maps.html', styleUrl: './maps.css' })
export class Maps {
  readonly reportSelected = output<Report>();
  readonly notify = output<string>();
  private readonly roleContext = inject(RoleContext);
  protected mapLevel: 'municipal' | 'regional' = ['superadmin', 'central-validator', 'regional-superadmin', 'regional-admin', 'supervisor'].includes(this.roleContext.activeRoleId()) ? 'regional' : 'municipal';
  protected metric: MapMetric = 'total';

  get reports() { return this.roleContext.activeRoleId() === 'establishment-manager' ? REPORTS.filter(report => report.code === '85481') : REPORTS; }
  get totalMetric() { return this.reports.reduce((sum, report) => sum + report[this.metric], 0); }
  get metricLabel() { return ({ total: 'Casos totales', newCases: 'Casos nuevos', controls: 'Controles', alerts: 'Alertas' } as const)[this.metric]; }
  setMetric(event: Event) { this.metric = (event.target as HTMLSelectElement).value as MapMetric; }
  resetFilters() { this.metric = 'total'; this.notify.emit('Filtros del mapa restablecidos.'); }
}
