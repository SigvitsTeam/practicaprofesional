import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { Report, ReportStatus } from '../../core/models';

@Component({ selector: 'app-report-drawer', imports: [CommonModule], templateUrl: './report-drawer.html', styleUrl: './report-drawer.css' })
export class ReportDrawer {
  readonly report = input.required<Report>();
  readonly close = output<void>();
  readonly action = output<string>();

  statusClass(status: ReportStatus) {
    return 'status-' + status.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s/g, '-');
  }
}
