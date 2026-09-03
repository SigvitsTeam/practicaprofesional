import { computed, inject, Injectable, signal } from '@angular/core';
import { map, tap, timeout } from 'rxjs';
import { formatHondurasMonth, hondurasDateParts } from './honduras-date';
import {
  ItsCaptureApiService,
  type MonthlyReportingPeriodResponse,
} from './its-capture-api.service';

export interface OperationalPeriod extends MonthlyReportingPeriodResponse {
  key: string;
  label: string;
}

export function reportingPeriodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function normalizeReportingPeriods(
  periods: readonly MonthlyReportingPeriodResponse[],
): OperationalPeriod[] {
  return periods
    .filter(
      (period) =>
        Number.isInteger(period.year) &&
        period.year >= 2020 &&
        period.year <= 2100 &&
        Number.isInteger(period.month) &&
        period.month >= 1 &&
        period.month <= 12,
    )
    .map((period) => ({
      ...period,
      key: reportingPeriodKey(period.year, period.month),
      label: formatHondurasMonth(period.year, period.month),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

@Injectable({ providedIn: 'root' })
export class OperationalPeriodService {
  private readonly api = inject(ItsCaptureApiService);
  readonly periods = signal<OperationalPeriod[]>([]);
  readonly selectedStartKey = signal('');
  readonly selectedEndKey = signal('');
  readonly selected = computed(() => {
    const periods = this.periods();
    const key = this.selectedEndKey();
    return periods.find((period) => period.key === key) ?? periods.at(-1);
  });

  load() {
    return this.fetchCatalog().pipe(tap((periods) => this.useCatalog(periods)));
  }

  /** Fetch without publishing state until the entire session bootstrap succeeds. */
  fetchCatalog(allowEmpty = false) {
    return this.api.getMonthlyReportingPeriods().pipe(
      timeout(10_000),
      map((periods) => {
        const normalized = normalizeReportingPeriods(periods);
        if (!normalized.length && !allowEmpty)
          throw new Error('No existen períodos mensuales configurados para SIGVITS.');
        return normalized;
      }),
    );
  }

  useDemoCatalog() {
    const periods = Array.from({ length: 7 }, (_, index) => {
      const month = index + 1;
      return {
        id: `demo-2026-${month}`,
        year: 2026,
        month,
        startDate: `2026-${String(month).padStart(2, '0')}-01`,
        endDate: new Date(Date.UTC(2026, month, 0)).toISOString().slice(0, 10),
        status: month === 7 ? ('ABIERTO' as const) : ('CERRADO' as const),
      };
    });
    this.useCatalog(normalizeReportingPeriods(periods));
  }

  refreshCatalog(periods: OperationalPeriod[]) {
    const start = this.selectedStartKey();
    const end = this.selectedEndKey();
    this.useCatalog(periods);
    if (periods.some((p) => p.key === start) && periods.some((p) => p.key === end)) {
      this.selectedStartKey.set(start);
      this.selectedEndKey.set(end);
    }
  }

  selectStart(key: string) {
    if (!this.periods().some((period) => period.key === key)) return;
    this.selectedStartKey.set(key);
    if (this.selectedEndKey() < key) this.selectedEndKey.set(key);
  }

  selectEnd(key: string) {
    if (!this.periods().some((period) => period.key === key)) return;
    this.selectedEndKey.set(key);
    if (this.selectedStartKey() > key) this.selectedStartKey.set(key);
  }

  clear() {
    this.periods.set([]);
    this.selectedStartKey.set('');
    this.selectedEndKey.set('');
  }

  useCatalog(periods: OperationalPeriod[]) {
    this.periods.set(periods);
    const current = hondurasDateParts();
    const currentKey = reportingPeriodKey(current.year, current.month);
    const started = periods.filter((period) => period.key <= currentKey);
    const preferred =
      periods.find((period) => period.key === currentKey && period.status === 'ABIERTO') ??
      [...started].reverse().find((period) => period.status === 'ABIERTO') ??
      started.at(-1) ??
      periods[0];
    const key = preferred?.key ?? '';
    this.selectedStartKey.set(key);
    this.selectedEndKey.set(key);
  }
}
