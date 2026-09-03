import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { timeout } from 'rxjs';
import { RuntimeConfigService } from './runtime-config.service';
import type { MonthlyReportingPeriodResponse } from './its-capture-api.service';

export interface ManagedPeriodRecord extends MonthlyReportingPeriodResponse {
  updatedAt: string;
  calendarReady: boolean;
}
export interface PeriodAuditRecord {
  id: string;
  action: string;
  reason: string | null;
  createdAt: string;
  actorName: string | null;
}
export interface AnnualOpeningResponse {
  openedMonths: number;
  alreadyOpenMonths: number;
  closedMonths: number;
}
@Injectable({ providedIn: 'root' })
export class PeriodAdminApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);
  private get endpoint() {
    return `${this.config.apiUrl}/v1/admin/reporting-periods`;
  }
  list(year: number) {
    return this.http
      .get<ManagedPeriodRecord[]>(this.endpoint, { params: { year } })
      .pipe(timeout(10_000));
  }
  createCalendar(year: number, reason: string, confirmNationalScope: boolean) {
    return this.http
      .post<{ createdMonths: number; createdWeeks: number }>(`${this.endpoint}/calendar`, {
        year,
        reason,
        confirmNationalScope,
      })
      .pipe(timeout(25_000));
  }
  open(period: ManagedPeriodRecord, reason: string, confirmNationalScope: boolean) {
    return this.http
      .post<ManagedPeriodRecord>(`${this.endpoint}/${period.id}/open`, {
        expectedUpdatedAt: period.updatedAt,
        reason,
        confirmNationalScope,
      })
      .pipe(timeout(20_000));
  }
  history(id: string) {
    return this.http
      .get<PeriodAuditRecord[]>(`${this.endpoint}/${id}/history`)
      .pipe(timeout(10_000));
  }
  openYear(
    year: number,
    periods: ManagedPeriodRecord[],
    reason: string,
    confirmNationalScope: boolean,
  ) {
    return this.http
      .post<AnnualOpeningResponse>(`${this.endpoint}/open-year`, {
        year,
        expectedPeriods: periods.map(({ id, updatedAt }) => ({ id, updatedAt })),
        reason,
        confirmNationalScope,
      })
      .pipe(timeout(30_000));
  }
}
