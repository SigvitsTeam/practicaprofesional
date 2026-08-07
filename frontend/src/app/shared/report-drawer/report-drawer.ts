import { CommonModule } from '@angular/common';
import { Component, inject, input, output } from '@angular/core';
import { Report, ReportStatus } from '../../core/models';
import { RoleContext } from '../../core/role-context';

@Component({ selector: 'app-report-drawer', imports: [CommonModule], templateUrl: './report-drawer.html', styleUrl: './report-drawer.css' })
export class ReportDrawer {
  readonly report = input.required<Report>();
  readonly close = output<void>();
  readonly action = output<string>();
  private readonly roleContext = inject(RoleContext);

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
}
