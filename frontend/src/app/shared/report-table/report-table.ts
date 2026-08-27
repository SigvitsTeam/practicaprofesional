import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { Report, ReportStatus } from '../../core/models';

@Component({
  selector: 'app-report-table',
  imports: [CommonModule],
  templateUrl: './report-table.html',
  styleUrl: './report-table.css',
})
export class ReportTable {
  readonly reports = input.required<Report[]>();
  readonly title = input<string>();
  readonly subtitle = input('Información consolidada ITS 2');
  readonly entityLabel = input('Establecimiento');
  readonly reportSelected = output<Report>();
  readonly viewAll = output<void>();

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
}
