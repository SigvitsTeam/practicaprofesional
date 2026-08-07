import { Component, effect, inject, output } from '@angular/core';
import { MUNICIPAL_REPORTS, REGIONAL_REPORTS, REPORTS } from '../../core/mock-data';
import { Report } from '../../core/models';
import { RoleContext } from '../../core/role-context';
import { InteractiveMap, MapLevel, MapMetric } from '../../shared/interactive-map/interactive-map';

@Component({ selector: 'app-maps', imports: [InteractiveMap], templateUrl: './maps.html', styleUrl: './maps.css' })
export class Maps {
  readonly reportSelected = output<Report>();
  readonly notify = output<string>();
  protected readonly roleContext = inject(RoleContext);
  protected mapLevel: MapLevel = ['superadmin', 'central-validator'].includes(this.roleContext.activeRoleId()) ? 'national' : ['regional-superadmin', 'regional-admin', 'supervisor'].includes(this.roleContext.activeRoleId()) ? 'regional' : 'municipal';
  protected metric: MapMetric = 'total';
  private lastRole = this.roleContext.activeRoleId();

  constructor() {
    effect(() => {
      const role = this.roleContext.activeRoleId();
      if (role === this.lastRole) return;
      this.lastRole = role;
      this.mapLevel = ['superadmin', 'central-validator'].includes(role) ? 'national' : ['regional-superadmin', 'regional-admin', 'supervisor'].includes(role) ? 'regional' : 'municipal';
      this.metric = 'total';
    });
  }

  get reports() {
    if (this.mapLevel === 'national') return REGIONAL_REPORTS;
    if (this.mapLevel === 'regional') return MUNICIPAL_REPORTS;
    return this.roleContext.activeRoleId() === 'establishment-manager' ? REPORTS.filter(report => report.code === '85481') : REPORTS;
  }
  get entityLabel() { return this.mapLevel === 'national' ? 'Regiones sanitarias' : this.mapLevel === 'regional' ? 'Municipios' : 'Establecimientos'; }
  get scopeLabel() { return this.mapLevel === 'national' ? 'Honduras' : this.mapLevel === 'regional' ? 'Región de Cortés' : this.roleContext.activeRoleId() === 'establishment-manager' ? 'CIS Linda Coello' : 'Puerto Cortés'; }
  get allowNational() { return ['superadmin', 'central-validator'].includes(this.roleContext.activeRoleId()); }
  get allowRegional() { return !['municipal-coordinator', 'establishment-manager'].includes(this.roleContext.activeRoleId()); }
  get allowMunicipal() { return this.roleContext.activeRoleId() !== 'establishment-manager'; }
  get totalMetric() { return this.reports.reduce((sum, report) => sum + report[this.metric], 0); }
  get metricLabel() { return ({ total: 'Casos totales', newCases: 'Casos nuevos', controls: 'Controles', alerts: 'Alertas' } as const)[this.metric]; }
  setMetric(event: Event) { this.metric = (event.target as HTMLSelectElement).value as MapMetric; }
  resetFilters() { this.metric = 'total'; this.notify.emit('Filtros del mapa restablecidos.'); }
}
