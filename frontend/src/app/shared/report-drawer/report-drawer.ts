import { CommonModule } from '@angular/common';
import { Component, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Report, ReportStatus } from '../../core/models';
import { RoleContext } from '../../core/role-context';
import { ItsCaptureApiService } from '../../core/its-capture-api.service';

@Component({ selector: 'app-report-drawer', imports: [CommonModule, FormsModule], templateUrl: './report-drawer.html', styleUrl: './report-drawer.css' })
export class ReportDrawer {
  readonly report = input.required<Report>();
  readonly close = output<void>();
  readonly action = output<string>();
  private readonly roleContext = inject(RoleContext);
  private readonly api = inject(ItsCaptureApiService);
  observation = '';
  loading = false;

  get canReview() {
    return ['central-validator', 'regional-superadmin', 'regional-admin', 'municipal-coordinator'].includes(this.roleContext.activeRoleId());
  }
  get entityLabel() {
    const role = this.roleContext.activeRoleId();
    return role === 'central-validator' ? 'CONSOLIDADO REGIONAL' : role.startsWith('regional-') ? 'CONSOLIDADO MUNICIPAL' : 'REPORTE ITS 2';
  }
  get senderLabel() {
    const role = this.roleContext.activeRoleId();
    return role === 'central-validator' ? 'Administración regional' : role.startsWith('regional-') ? 'Coordinación municipal' : 'Responsable del establecimiento';
  }

  statusClass(status: ReportStatus) {
    return 'status-' + status.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s/g, '-');
  }
  returnReport() {
    const id = this.report().workflowId;
    if (!id) { this.action.emit('La devolución solo está disponible para reportes reales.'); return; }
    if (!this.observation.trim()) { this.action.emit('Escriba el motivo de devolución.'); return; }
    this.loading = true;
    this.api.returnIts2Report(id, this.observation.trim()).subscribe({
      next: () => { this.loading = false; this.action.emit('Reporte devuelto con observación y registrado en auditoría.'); },
      error: error => { this.loading = false; this.action.emit(error.error?.message ?? 'No fue posible devolver el reporte.'); },
    });
  }
  approveReport() {
    const id = this.report().workflowId;
    if (!id) { this.action.emit('La aprobación solo está disponible para reportes reales.'); return; }
    this.loading = true;
    this.api.approveIts2Report(id, this.observation.trim() || undefined).subscribe({
      next: () => { this.loading = false; this.action.emit('Reporte aprobado y registrado en auditoría.'); },
      error: error => { this.loading = false; this.action.emit(error.error?.message ?? 'No fue posible aprobar el reporte.'); },
    });
  }
}
