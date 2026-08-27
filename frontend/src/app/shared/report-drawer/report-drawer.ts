import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, Observable } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { formatHondurasDateTime, formatHondurasMonth } from '../../core/honduras-date';
import { Report, ReportStatus } from '../../core/models';
import { RoleContext } from '../../core/role-context';
import { ItsCaptureApiService } from '../../core/its-capture-api.service';

interface ReportHistoryItem {
  label: string;
  date: string;
  actor: string;
}

@Component({
  selector: 'app-report-drawer',
  imports: [CommonModule, FormsModule],
  templateUrl: './report-drawer.html',
  styleUrl: './report-drawer.css',
})
export class ReportDrawer implements AfterViewInit {
  readonly report = input.required<Report>();
  readonly dismiss = output<void>();
  readonly action = output<string>();
  readonly navigate = output<string>();
  private readonly roleContext = inject(RoleContext);
  private readonly auth = inject(AuthService);
  private readonly api = inject(ItsCaptureApiService);
  private readonly closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');
  observation = '';
  loading = false;
  errorMessage = '';

  ngAfterViewInit() {
    this.closeButton()?.nativeElement.focus();
  }

  @HostListener('document:keydown.escape')
  closeOnEscape() {
    if (!this.loading) this.dismiss.emit();
  }

  get canReview() {
    return [
      'central-validator',
      'regional-superadmin',
      'regional-admin',
      'municipal-coordinator',
    ].includes(this.roleContext.activeRoleId());
  }

  get canAct() {
    return (
      !this.auth.isDemo() &&
      this.canReview &&
      Boolean(this.report().workflowId) &&
      this.report().status === 'En revisión'
    );
  }

  get entityLabel() {
    const role = this.roleContext.activeRoleId();
    return role === 'central-validator'
      ? 'CONSOLIDADO REGIONAL'
      : role.startsWith('regional-')
        ? 'CONSOLIDADO MUNICIPAL'
        : 'REPORTE ITS 2';
  }

  get periodLabel() {
    const report = this.report();
    if (!report.periodYear || !report.periodMonth) return 'PERÍODO DE DEMOSTRACIÓN';
    return formatHondurasMonth(report.periodYear, report.periodMonth).toLocaleUpperCase('es-HN');
  }

  get qualityChecks() {
    const report = this.report();
    const checks: { label: string; detail: string; warning: boolean }[] = [];
    if (report.attentionTotalsComplete !== undefined) {
      checks.push({
        label: 'Totales de atenciones por edad',
        detail: report.attentionTotalsComplete ? 'Completos' : 'Requieren completar información',
        warning: !report.attentionTotalsComplete,
      });
    }
    checks.push({
      label: 'Observaciones abiertas',
      detail: report.alerts
        ? `${report.alerts} requieren seguimiento`
        : 'Sin observaciones abiertas',
      warning: report.alerts > 0,
    });
    if (report.caseBreakdownAvailable) {
      checks.push({
        label: 'Desglose de diagnósticos',
        detail: `${report.newCases} nuevos · ${report.controls} controles`,
        warning: false,
      });
    }
    return checks;
  }

  get history(): ReportHistoryItem[] {
    const report = this.report();
    return [
      report.generatedAt
        ? {
            label: 'Versión generada',
            date: this.formatDate(report.generatedAt),
            actor: 'Proceso institucional',
          }
        : undefined,
      report.sentAt
        ? {
            label: 'Información enviada al siguiente nivel',
            date: this.formatDate(report.sentAt),
            actor: 'Usuario remitente',
          }
        : undefined,
      report.approvedAt
        ? {
            label: 'Reporte aprobado',
            date: this.formatDate(report.approvedAt),
            actor: 'Nivel revisor',
          }
        : undefined,
    ].filter((item): item is ReportHistoryItem => item !== undefined);
  }

  statusClass(status: ReportStatus) {
    return (
      'status-' +
      status
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s/g, '-')
    );
  }

  returnReport() {
    const report = this.report();
    const id = report.workflowId;
    if (!this.canAct || !id) return;
    if (!this.observation.trim()) {
      this.errorMessage = 'Escriba el motivo de devolución.';
      return;
    }
    const operation: Observable<unknown> =
      report.workflowLevel === 'regional'
        ? this.api.returnRegionalConsolidation(id, this.observation.trim())
        : report.workflowLevel === 'municipal'
          ? this.api.returnMunicipalConsolidation(id, this.observation.trim())
          : this.api.returnIts2Report(id, this.observation.trim());
    this.execute(
      operation,
      'Reporte devuelto con observación y registrado en auditoría.',
      'devolver',
    );
  }

  approveReport() {
    const report = this.report();
    const id = report.workflowId;
    if (!this.canAct || !id) return;
    const comment = this.observation.trim() || undefined;
    const operation: Observable<unknown> =
      report.workflowLevel === 'regional'
        ? this.api.approveRegionalConsolidation(id, comment)
        : report.workflowLevel === 'municipal'
          ? this.api.approveMunicipalConsolidation(id, comment)
          : this.api.approveIts2Report(id, comment);
    this.execute(operation, 'Reporte aprobado y registrado en auditoría.', 'aprobar');
  }

  private execute(operation: Observable<unknown>, success: string, verb: string) {
    this.loading = true;
    this.errorMessage = '';
    operation.pipe(finalize(() => (this.loading = false))).subscribe({
      next: () => this.action.emit(success),
      error: (error: unknown) => {
        this.errorMessage = this.errorDetail(error, `No fue posible ${verb} el reporte.`);
      },
    });
  }

  protected formatDate(value: string) {
    return formatHondurasDateTime(value);
  }

  private errorDetail(error: unknown, fallback: string) {
    if (typeof error !== 'object' || error === null) return fallback;
    const response = (error as { error?: { detail?: unknown } }).error;
    return typeof response?.detail === 'string' ? response.detail : fallback;
  }
}
