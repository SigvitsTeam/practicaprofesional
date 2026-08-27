import { Component, DestroyRef, effect, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin, map, Observable, of } from 'rxjs';
import { MUNICIPAL_REPORTS, REGIONAL_REPORTS, REPORTS } from '../../core/mock-data';
import { AuthService } from '../../core/auth.service';
import {
  formatHondurasDateTime,
  formatHondurasMonth,
} from '../../core/honduras-date';
import {
  ItsCaptureApiService,
  Its2WorkflowReport,
  MunicipalConsolidationReport,
  RegionalConsolidationReport,
  TerritorialAnalyticsResponse,
} from '../../core/its-capture-api.service';
import { Report } from '../../core/models';
import { RoleContext } from '../../core/role-context';
import { OperationalPeriodService } from '../../core/operational-period';
import { ReportTable } from '../../shared/report-table/report-table';

type AnalyticsRow = TerritorialAnalyticsResponse['rows'][number];
type InboxStatusFilter = 'Todos' | Report['status'];

@Component({
  selector: 'app-review-inbox',
  imports: [FormsModule, ReportTable],
  templateUrl: './review-inbox.html',
  styleUrl: './review-inbox.css',
})
export class ReviewInbox {
  readonly reportSelected = output<Report>();
  readonly navigate = output<string>();
  private readonly roleContext = inject(RoleContext);
  private readonly auth = inject(AuthService);
  private readonly api = inject(ItsCaptureApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly operationalPeriod = inject(OperationalPeriodService);
  private readonly liveReports = signal<Report[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadError = signal('');
  private requestVersion = 0;
  protected readonly statusOptions: InboxStatusFilter[] = [
    'Todos',
    'En revisión',
    'Aprobado',
    'Devuelto',
    'Pendiente',
  ];

  search = '';
  statusFilter: InboxStatusFilter = 'Todos';

  constructor() {
    effect(() => {
      this.roleContext.activeRoleId();
      const periodKey = this.operationalPeriod.selectedEndKey();
      if (periodKey) this.reload();
    });
  }

  protected get year() {
    return this.operationalPeriod.selected()?.year ?? 0;
  }
  protected get month() {
    return this.operationalPeriod.selected()?.month ?? 0;
  }
  protected get periodLabel() {
    return this.year && this.month ? formatHondurasMonth(this.year, this.month) : '—';
  }

  reload() {
    if (this.auth.isDemo()) return;
    const requestVersion = ++this.requestVersion;
    this.loading.set(true);
    this.loadError.set('');
    this.inboxRequest()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (reports) => {
          if (requestVersion !== this.requestVersion) return;
          this.liveReports.set(reports);
          this.loading.set(false);
        },
        error: () => {
          if (requestVersion !== this.requestVersion) return;
          this.liveReports.set([]);
          this.loading.set(false);
          this.loadError.set(`No fue posible cargar la bandeja ${this.inboxLevelLabel}.`);
        },
      });
  }

  get sourceReports() {
    if (!this.auth.isDemo()) return this.liveReports();
    const role = this.roleContext.activeRoleId();
    if (role === 'central-validator') return REGIONAL_REPORTS;
    if (role === 'regional-admin' || role === 'regional-superadmin') return MUNICIPAL_REPORTS;
    return REPORTS;
  }

  get reports() {
    const query = this.search.trim().toLocaleLowerCase('es');
    return this.sourceReports.filter(
      (report) =>
        (this.statusFilter === 'Todos' || report.status === this.statusFilter) &&
        (!query ||
          report.name.toLocaleLowerCase('es').includes(query) ||
          report.code.toLocaleLowerCase('es').includes(query)),
    );
  }

  get entityLabel() {
    const role = this.roleContext.activeRoleId();
    return role === 'central-validator'
      ? 'Región sanitaria'
      : role.startsWith('regional-')
        ? 'Municipio'
        : 'Establecimiento';
  }

  get scopeDescription() {
    if (!this.auth.isDemo())
      return `${this.entityLabel}: información dentro del alcance institucional autorizado`;
    return this.entityLabel === 'Región sanitaria'
      ? 'Consolidados regionales recibidos por Nivel Central'
      : this.entityLabel === 'Municipio'
        ? 'Consolidados municipales de la Región de Cortés'
        : 'Reportes ITS 2 de Puerto Cortés';
  }

  count(status: Report['status']) {
    return this.sourceReports.filter((report) => report.status === status).length;
  }

  private get inboxLevelLabel() {
    const role = this.roleContext.activeRoleId();
    return role === 'central-validator'
      ? 'central'
      : role.startsWith('regional-')
        ? 'regional'
        : 'municipal';
  }

  private inboxRequest(): Observable<Report[]> {
    const role = this.roleContext.activeRoleId();
    if (role === 'municipal-coordinator') {
      return forkJoin({
        workflow: this.api.getMunicipalIts2Inbox(this.year, this.month),
        analytics: this.api.getTerritorialAnalytics('ESTABLECIMIENTO', this.year, this.month),
      }).pipe(
        map(({ workflow, analytics }) =>
          workflow.map((report) =>
            this.toFacilityReport(
              report,
              this.metricFor(analytics.rows, report.id, report.facility.id),
            ),
          ),
        ),
      );
    }
    if (role === 'regional-admin' || role === 'regional-superadmin') {
      return forkJoin({
        workflow: this.api.getRegionalConsolidationInbox(this.year, this.month),
        analytics: this.api.getTerritorialAnalytics('MUNICIPIO', this.year, this.month),
      }).pipe(
        map(({ workflow, analytics }) =>
          workflow.map((report) =>
            this.toMunicipalReport(
              report,
              this.metricFor(analytics.rows, report.id, report.municipality.id),
            ),
          ),
        ),
      );
    }
    if (role === 'central-validator') {
      return forkJoin({
        workflow: this.api.getCentralConsolidationInbox(this.year, this.month),
        analytics: this.api.getTerritorialAnalytics('REGION', this.year, this.month),
      }).pipe(
        map(({ workflow, analytics }) =>
          workflow.map((report) =>
            this.toRegionalReport(
              report,
              this.metricFor(analytics.rows, report.id, report.region.id),
            ),
          ),
        ),
      );
    }
    return of([]);
  }

  private metricFor(rows: AnalyticsRow[], reportId: string, entityId: string) {
    return rows.find((row) => row.reportId === reportId) ?? rows.find((row) => row.id === entityId);
  }

  private toFacilityReport(report: Its2WorkflowReport, metric?: AnalyticsRow): Report {
    return this.baseReport({
      workflowId: report.id,
      workflowLevel: 'facility',
      version: report.version,
      name: report.facility.name,
      code: report.facility.code,
      status: {
        ENVIADO_A_MUNICIPIO: 'En revisión',
        DEVUELTO_POR_MUNICIPIO: 'Devuelto',
        APROBADO_MUNICIPIO: 'Aprobado',
        BORRADOR: 'Pendiente',
      }[report.status] as Report['status'],
      total: report.totalAttentions,
      metric,
      report,
    });
  }

  private toMunicipalReport(report: MunicipalConsolidationReport, metric?: AnalyticsRow): Report {
    return this.baseReport({
      workflowId: report.id,
      workflowLevel: 'municipal',
      version: report.version,
      name: report.municipality.name,
      code: report.municipality.code,
      status: {
        ENVIADO_A_REGION: 'En revisión',
        DEVUELTO_POR_REGION: 'Devuelto',
        APROBADO_REGION: 'Aprobado',
        BORRADOR: 'Pendiente',
      }[report.status] as Report['status'],
      total: report.sourceAttentionCount,
      metric,
      report,
    });
  }

  private toRegionalReport(report: RegionalConsolidationReport, metric?: AnalyticsRow): Report {
    return this.baseReport({
      workflowId: report.id,
      workflowLevel: 'regional',
      version: report.version,
      name: report.region.name,
      code: report.region.code,
      status: {
        ENVIADO_A_CENTRAL: 'En revisión',
        DEVUELTO_POR_CENTRAL: 'Devuelto',
        APROBADO_CENTRAL: 'Aprobado',
        BORRADOR: 'Pendiente',
      }[report.status] as Report['status'],
      total: report.sourceAttentionCount,
      metric,
      report,
    });
  }

  private baseReport(input: {
    workflowId: string;
    workflowLevel: NonNullable<Report['workflowLevel']>;
    version: number;
    name: string;
    code: string;
    status: Report['status'];
    total: number;
    metric?: AnalyticsRow;
    report: {
      year: number;
      month: number;
      generatedAt: string;
      sentAt?: string;
      approvedAt?: string;
      attentionTotalsComplete: boolean;
      currentComment?: string;
      openObservations: { id: string; comment: string; createdAt: string }[];
    };
  }): Report {
    const report = input.report;
    return {
      workflowId: input.workflowId,
      workflowLevel: input.workflowLevel,
      version: input.version,
      name: input.name,
      code: input.code,
      status: input.status,
      total: input.total,
      newCases: input.metric?.newCases ?? 0,
      controls: input.metric?.controls ?? 0,
      caseBreakdownAvailable: Boolean(input.metric),
      alerts: report.openObservations.length,
      sent: report.sentAt ? this.formatDate(report.sentAt) : 'Sin envío',
      periodYear: report.year,
      periodMonth: report.month,
      generatedAt: report.generatedAt,
      sentAt: report.sentAt,
      approvedAt: report.approvedAt,
      attentionTotalsComplete: report.attentionTotalsComplete,
      currentComment: report.currentComment,
      openObservations: report.openObservations,
    };
  }

  private formatDate(value: string) {
    return formatHondurasDateTime(value);
  }
}
