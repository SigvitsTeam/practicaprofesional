import { Component, output } from '@angular/core';
import { REPORTS } from '../../core/mock-data';
import { Report } from '../../core/models';
import { ReportTable } from '../../shared/report-table/report-table';

@Component({
  selector: 'app-dashboard',
  imports: [ReportTable],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  readonly navigate = output<string>();
  readonly reportSelected = output<Report>();
  readonly notify = output<string>();
  protected readonly reports = REPORTS;
  protected readonly trend = [112, 126, 118, 147, 156, 171, 184];
  protected readonly months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul'];
}
