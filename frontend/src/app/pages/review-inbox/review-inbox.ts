import { Component, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { REPORTS } from '../../core/mock-data';
import { Report } from '../../core/models';
import { ReportTable } from '../../shared/report-table/report-table';

@Component({ selector: 'app-review-inbox', imports: [FormsModule, ReportTable], templateUrl: './review-inbox.html', styleUrl: './review-inbox.css' })
export class ReviewInbox {
  readonly reportSelected = output<Report>();
  readonly notify = output<string>();
  search = '';
  get reports() { const q = this.search.trim().toLowerCase(); return q ? REPORTS.filter(item => item.name.toLowerCase().includes(q)) : REPORTS; }
}
