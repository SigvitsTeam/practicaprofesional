import { Component, inject, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MUNICIPAL_REPORTS, REGIONAL_REPORTS, REPORTS } from '../../core/mock-data';
import { Report } from '../../core/models';
import { RoleContext } from '../../core/role-context';
import { ReportTable } from '../../shared/report-table/report-table';

@Component({ selector: 'app-review-inbox', imports: [FormsModule, ReportTable], templateUrl: './review-inbox.html', styleUrl: './review-inbox.css' })
export class ReviewInbox {
  readonly reportSelected = output<Report>();
  readonly notify = output<string>();
  private readonly roleContext = inject(RoleContext);
  search = '';
  get sourceReports() {
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
    const role = this.roleContext.activeRoleId();
    if (role === 'central-validator') return ({ Aprobado: 0, 'En revisión': 1, Devuelto: 0, Pendiente: 17 } as Record<Report['status'], number>)[status];
    if (role === 'regional-admin' || role === 'regional-superadmin') return ({ Aprobado: 1, 'En revisión': 1, Devuelto: 0, Pendiente: 10 } as Record<Report['status'], number>)[status];
    return this.sourceReports.filter(report => report.status === status).length;
  }
}
