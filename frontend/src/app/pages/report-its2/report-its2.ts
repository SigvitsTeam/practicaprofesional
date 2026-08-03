import { Component, inject, output } from '@angular/core';
import { EstablishmentContext } from '../../core/establishment-context';
import { REPORTS } from '../../core/mock-data';
import { EstablishmentSelector } from '../../shared/establishment-selector/establishment-selector';

@Component({ selector: 'app-report-its2', imports: [EstablishmentSelector], templateUrl: './report-its2.html', styleUrl: './report-its2.css' })
export class ReportIts2 {
  readonly notify = output<string>();
  protected readonly context = inject(EstablishmentContext);
  get report() { return REPORTS.find(item => item.code === this.context.selectedCode()); }
  get total() { return this.report?.total ?? 0; }
  get newCases() { return this.report?.newCases ?? 0; }
  get controls() { return this.report?.controls ?? 0; }
  get correctionRequested() { return this.report?.status === 'Devuelto'; }
}
