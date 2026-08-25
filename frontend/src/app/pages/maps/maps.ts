import { Component, DestroyRef, effect, inject, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { MUNICIPAL_REPORTS, REGIONAL_REPORTS, REPORTS } from '../../core/mock-data';
import { AuthService } from '../../core/auth.service';
import {
  ItsCaptureApiService,
  TerritorialAnalyticsLevel,
} from '../../core/its-capture-api.service';
import { Report } from '../../core/models';
import { RoleContext } from '../../core/role-context';
import { InteractiveMap, MapLevel, MapMetric } from '../../shared/interactive-map/interactive-map';

@Component({
  selector: 'app-maps',
  imports: [InteractiveMap],
  templateUrl: './maps.html',
  styleUrl: './maps.css',
})
export class Maps implements OnInit {
  readonly reportSelected = output<Report>();
  readonly notify = output<string>();
  protected readonly roleContext = inject(RoleContext);
  private readonly auth = inject(AuthService);
  private readonly api = inject(ItsCaptureApiService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly liveReports = signal<Report[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadError = signal('');
  protected mapLevel: MapLevel = ['superadmin', 'central-validator'].includes(
    this.roleContext.activeRoleId(),
  )
    ? 'national'
    : ['regional-superadmin', 'regional-admin', 'supervisor'].includes(
          this.roleContext.activeRoleId(),
        )
      ? 'regional'
      : 'municipal';
  protected metric: MapMetric = 'total';
  private lastRole = this.roleContext.activeRoleId();

  constructor() {
    effect(() => {
      const role = this.roleContext.activeRoleId();
      if (role === this.lastRole) return;
      this.lastRole = role;
      this.mapLevel = ['superadmin', 'central-validator'].includes(role)
        ? 'national'
        : ['regional-superadmin', 'regional-admin', 'supervisor'].includes(role)
          ? 'regional'
          : 'municipal';
      this.metric = 'total';
      this.load();
    });
  }

  ngOnInit() {
    this.load();
  }

  get reports() {
    if (!this.auth.isDemo()) return this.liveReports();
    if (this.mapLevel === 'national') return REGIONAL_REPORTS;
    if (this.mapLevel === 'regional') return MUNICIPAL_REPORTS;
    return this.roleContext.activeRoleId() === 'establishment-manager'
      ? REPORTS.filter((report) => report.code === '85481')
      : REPORTS;
  }
  get entityLabel() {
    return this.mapLevel === 'national'
      ? 'Regiones sanitarias'
      : this.mapLevel === 'regional'
        ? 'Municipios'
        : 'Establecimientos';
  }
  get scopeLabel() {
    if (!this.auth.isDemo())
      return this.mapLevel === 'national'
        ? 'Honduras'
        : this.mapLevel === 'regional'
          ? 'Región autorizada'
          : this.roleContext.activeRoleId() === 'establishment-manager'
            ? 'Establecimiento autorizado'
            : 'Municipio autorizado';
    return this.mapLevel === 'national'
      ? 'Honduras'
      : this.mapLevel === 'regional'
        ? 'Región de Cortés'
        : this.roleContext.activeRoleId() === 'establishment-manager'
          ? 'CIS Linda Coello'
          : 'Puerto Cortés';
  }
  get allowNational() {
    return ['superadmin', 'central-validator'].includes(this.roleContext.activeRoleId());
  }
  get allowRegional() {
    return !['municipal-coordinator', 'establishment-manager'].includes(
      this.roleContext.activeRoleId(),
    );
  }
  get allowMunicipal() {
    return this.roleContext.activeRoleId() !== 'establishment-manager';
  }
  get totalMetric() {
    return this.reports.reduce((sum, report) => sum + report[this.metric], 0);
  }
  get metricLabel() {
    return (
      {
        total: 'Casos totales',
        newCases: 'Casos nuevos',
        controls: 'Controles',
        alerts: 'Alertas',
      } as const
    )[this.metric];
  }
  setMetric(event: Event) {
    this.metric = (event.target as HTMLSelectElement).value as MapMetric;
  }
  setLevel(level: MapLevel) {
    this.mapLevel = level;
    this.metric = 'total';
    this.load();
  }
  resetFilters() {
    this.metric = 'total';
    this.notify.emit('Filtros del mapa restablecidos.');
  }

  private load() {
    if (this.auth.isDemo()) return;
    const level = (
      { national: 'REGION', regional: 'MUNICIPIO', municipal: 'ESTABLECIMIENTO' } as const
    )[this.mapLevel] satisfies TerritorialAnalyticsLevel;
    this.loading.set(true);
    this.loadError.set('');
    this.api
      .getTerritorialAnalytics(level, new Date().getFullYear(), new Date().getMonth() + 1)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (result) =>
          this.liveReports.set(
            result.rows.map((row) => ({
              workflowId: row.reportId,
              workflowLevel:
                level === 'REGION' ? 'regional' : level === 'MUNICIPIO' ? 'municipal' : 'facility',
              version: row.reportVersion,
              name: row.name,
              code: row.code,
              status: this.reportStatus(row.status),
              total: row.attentions,
              newCases: row.newCases,
              controls: row.controls,
              alerts: row.alerts,
              sent: row.sentAt ? new Date(row.sentAt).toLocaleString('es-HN') : 'Sin envío',
              latitude: row.latitude,
              longitude: row.longitude,
              coordinatesValidated: row.coordinatesValidated,
            })),
          ),
        error: () => {
          this.liveReports.set([]);
          this.loadError.set('No fue posible cargar los indicadores territoriales reales.');
        },
      });
  }

  private reportStatus(status: string): Report['status'] {
    if (
      status.startsWith('APROBADO') ||
      ['CONSOLIDADO_NACIONAL', 'CERRADO_OFICIAL'].includes(status)
    )
      return 'Aprobado';
    if (status.startsWith('ENVIADO')) return 'En revisión';
    if (status.startsWith('DEVUELTO')) return 'Devuelto';
    return 'Pendiente';
  }
}
