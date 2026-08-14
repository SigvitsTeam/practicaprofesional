import { Component, DestroyRef, inject, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MUNICIPAL_REPORTS, REGIONAL_REPORTS, REPORTS } from '../../core/mock-data';
import { AuthService } from '../../core/auth.service';
import { ItsCaptureApiService, Its2WorkflowReport } from '../../core/its-capture-api.service';
import { Report } from '../../core/models';
import { RoleContext } from '../../core/role-context';
import { ReportTable } from '../../shared/report-table/report-table';

@Component({ selector: 'app-review-inbox', imports: [FormsModule, ReportTable], templateUrl: './review-inbox.html', styleUrl: './review-inbox.css' })
export class ReviewInbox implements OnInit {
  readonly reportSelected = output<Report>();
  readonly notify = output<string>();
  private readonly roleContext = inject(RoleContext);
  private readonly auth = inject(AuthService);
  private readonly api = inject(ItsCaptureApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly liveReports = signal<Report[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadError = signal('');
  search = '';
  ngOnInit() { this.reload(); }
  reload() {
    if (this.auth.isDemo() || this.roleContext.activeRoleId() !== 'municipal-coordinator') return;
    this.loading.set(true); this.loadError.set('');
    this.api.getMunicipalIts2Inbox(2026, 8).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: reports => { this.liveReports.set(reports.map(report => this.toTableReport(report))); this.loading.set(false); },
      error: () => { this.liveReports.set([]); this.loading.set(false); this.loadError.set('No fue posible cargar la bandeja municipal.'); },
    });
  }
  get sourceReports() {
    if (!this.auth.isDemo()) return this.liveReports();
    const role = this.roleContext.activeRoleId();
    if (role === 'central-validator') return REGIONAL_REPORTS;
    if (role === 'regional-admin' || role === 'regional-superadmin') return MUNICIPAL_REPORTS;
    return REPORTS;
  }
  get reports() { const q = this.search.trim().toLowerCase(); return q ? this.sourceReports.filter(item => item.name.toLowerCase().includes(q)) : this.sourceReports; }
  get entityLabel() {
    const role = this.roleContext.activeRoleId();
    return role === 'central-validator' ? 'Región sanitaria' : role.startsWith('regional-') ? 'Municipio' : 'Establecimiento';
  }
  get scopeDescription() {
    return this.entityLabel === 'Región sanitaria' ? 'Consolidados regionales recibidos por Nivel Central' : this.entityLabel === 'Municipio' ? 'Consolidados municipales de la Región de Cortés' : 'Reportes ITS 2 de Puerto Cortés';
  }
  count(status: Report['status']) {
    if (!this.auth.isDemo()) return this.sourceReports.filter(report => report.status === status).length;
    const role = this.roleContext.activeRoleId();
    if (role === 'central-validator') return ({ Aprobado: 0, 'En revisión': 1, Devuelto: 0, Pendiente: 17 } as Record<Report['status'], number>)[status];
    if (role === 'regional-admin' || role === 'regional-superadmin') return ({ Aprobado: 1, 'En revisión': 1, Devuelto: 0, Pendiente: 10 } as Record<Report['status'], number>)[status];
    return this.sourceReports.filter(report => report.status === status).length;
  }
  private toTableReport(report: Its2WorkflowReport): Report {
    const status = ({ ENVIADO_A_MUNICIPIO: 'En revisión', DEVUELTO_POR_MUNICIPIO: 'Devuelto', APROBADO_MUNICIPIO: 'Aprobado', BORRADOR: 'Pendiente' } as const)[report.status];
    return { workflowId: report.id, version: report.version, name: report.facility.name, code: report.facility.code, status, total: report.totalAttentions, newCases: 0, controls: 0, alerts: report.openObservations.length, sent: report.sentAt ? new Date(report.sentAt).toLocaleString('es-HN') : '—' };
  }
}
