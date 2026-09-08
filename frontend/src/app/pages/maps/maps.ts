import { Component, DestroyRef, effect, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { MUNICIPAL_REPORTS, REGIONAL_REPORTS, REPORTS } from '../../core/mock-data';
import { AuthService } from '../../core/auth.service';
import { formatHondurasDateTime } from '../../core/honduras-date';
import {
  ItsCaptureApiService,
  TerritorialAnalyticsLevel,
  TerritorialAnalyticsMetric,
} from '../../core/its-capture-api.service';
import { Report } from '../../core/models';
import { RoleContext } from '../../core/role-context';
import { RuntimeConfigService } from '../../core/runtime-config.service';
import { formatSmallCount } from '../../core/small-count';
import { OperationalPeriodService } from '../../core/operational-period';
import { InteractiveMap, MapLevel, MapMetric } from '../../shared/interactive-map/interactive-map';

@Component({
  selector: 'app-maps',
  imports: [InteractiveMap],
  templateUrl: './maps.html',
  styleUrl: './maps.css',
})
export class Maps {
  readonly reportSelected = output<Report>();
  readonly notify = output<string>();
  protected readonly roleContext = inject(RoleContext);
  private readonly auth = inject(AuthService);
  private readonly api = inject(ItsCaptureApiService);
  private readonly runtimeConfig = inject(RuntimeConfigService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly operationalPeriod = inject(OperationalPeriodService);
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
  protected selectedRegion?: { id: string; name: string };
  protected selectedMunicipality?: { id: string; name: string };
  private lastQuery = '';
  private requestVersion = 0;

  constructor() {
    effect(() => {
      const role = this.roleContext.activeRoleId();
      const periodKey = this.operationalPeriod.selectedEndKey();
      const query = `${role}:${periodKey}`;
      if (!periodKey || query === this.lastQuery) return;
      this.lastQuery = query;
      this.mapLevel = ['superadmin', 'central-validator'].includes(role)
        ? 'national'
        : ['regional-superadmin', 'regional-admin', 'supervisor'].includes(role)
          ? 'regional'
          : 'municipal';
      this.metric = 'total';
      this.selectedRegion = undefined;
      this.selectedMunicipality = undefined;
      this.load();
    });
  }

  get reports() {
    if (!this.auth.isDemo()) return this.liveReports();
    if (this.mapLevel === 'national') return REGIONAL_REPORTS;
    if (this.mapLevel === 'regional')
      return this.selectedRegion
        ? MUNICIPAL_REPORTS.filter((report) => report.code.startsWith(this.selectedRegion!.id))
        : MUNICIPAL_REPORTS;
    if (this.selectedMunicipality && this.selectedMunicipality.id !== '0506') return [];
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
    if (this.mapLevel === 'regional' && this.selectedRegion) return this.selectedRegion.name;
    if (this.mapLevel === 'municipal' && this.selectedMunicipality)
      return this.selectedMunicipality.name;
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
  get totalMetric() {
    return this.reports.reduce((sum, report) => sum + report[this.metric], 0);
  }
  get totalMetricDisplay() {
    if (
      this.reports.some(
        (report) =>
          report.suppressedMetrics?.includes(this.metric) ||
          report.complementarySuppressedMetrics?.includes(this.metric),
      )
    )
      return 'Protegido';
    return formatSmallCount(this.totalMetric, this.runtimeConfig.maps.smallCountThreshold);
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
    if (level === 'national') {
      this.selectedRegion = undefined;
      this.selectedMunicipality = undefined;
    } else if (level === 'regional') {
      this.selectedMunicipality = undefined;
    }
    this.mapLevel = level;
    this.metric = 'total';
    this.load();
  }
  selectMapEntity(report: Report) {
    if (this.mapLevel === 'national') {
      this.selectedRegion = { id: report.territoryId ?? report.code, name: report.name };
      this.selectedMunicipality = undefined;
      this.setLevel('regional');
      return;
    }
    if (this.mapLevel === 'regional') {
      this.selectedMunicipality = { id: report.territoryId ?? report.code, name: report.name };
      this.setLevel('municipal');
      return;
    }
    this.reportSelected.emit(report);
  }
  resetFilters() {
    this.metric = 'total';
    this.notify.emit('Filtros del mapa restablecidos.');
  }
  retryLoad() {
    this.load();
  }

  reload() {
    this.load();
  }

  private load() {
    const requestVersion = ++this.requestVersion;
    if (this.auth.isDemo()) {
      this.loading.set(false);
      this.loadError.set('');
      return;
    }
    const level = (
      { national: 'REGION', regional: 'MUNICIPIO', municipal: 'ESTABLECIMIENTO' } as const
    )[this.mapLevel] satisfies TerritorialAnalyticsLevel;
    this.loading.set(true);
    this.loadError.set('');
    this.liveReports.set([]);
    const period = this.operationalPeriod.selected();
    if (!period) {
      this.loading.set(false);
      return;
    }
    const { year, month } = period;
    const parent =
      level === 'MUNICIPIO' && this.selectedRegion
        ? { regionId: this.selectedRegion.id }
        : level === 'ESTABLECIMIENTO' && this.selectedMunicipality
          ? { municipalityId: this.selectedMunicipality.id }
          : undefined;
    this.api
      .getTerritorialAnalytics(level, year, month, parent)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (requestVersion === this.requestVersion) this.loading.set(false);
        }),
      )
      .subscribe({
        next: (result) => {
          if (requestVersion !== this.requestVersion) return;
          this.liveReports.set(
            result.rows.map((row) => {
              const primary = (row.suppressedMetrics ?? []).map((metric) =>
                this.reportMetric(metric),
              );
              const complementary = (row.complementarySuppressedMetrics ?? []).map((metric) =>
                this.reportMetric(metric),
              );
              return {
                territoryId: row.id,
                workflowId: row.reportId,
                periodYear: year,
                periodMonth: month,
                workflowLevel:
                  level === 'REGION'
                    ? 'regional'
                    : level === 'MUNICIPIO'
                      ? 'municipal'
                      : 'facility',
                version: row.reportVersion,
                name: row.name,
                code: row.code,
                status: this.reportStatus(row.status),
                total: row.attentions ?? 0,
                newCases: row.newCases ?? 0,
                controls: row.controls ?? 0,
                caseBreakdownAvailable: true,
                alerts: row.alerts ?? 0,
                sent: row.sentAt ? formatHondurasDateTime(row.sentAt) : 'Sin envío',
                latitude: row.latitude,
                longitude: row.longitude,
                coordinatesValidated: row.coordinatesValidated,
                suppressedMetrics: [...new Set([...primary, ...complementary])],
                complementarySuppressedMetrics: complementary,
                smallCountThreshold:
                  result.privacy?.smallCountThreshold ??
                  this.runtimeConfig.maps.smallCountThreshold,
              };
            }),
          );
        },
        error: () => {
          if (requestVersion !== this.requestVersion) return;
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

  private reportMetric(
    metric: TerritorialAnalyticsMetric,
  ): NonNullable<Report['suppressedMetrics']>[number] {
    return metric === 'attentions' ? 'total' : metric;
  }
}
