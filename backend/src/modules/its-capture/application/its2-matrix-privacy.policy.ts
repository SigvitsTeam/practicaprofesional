import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ItsMonthlyReport, MonthlyReportRow } from '../domain/its-monthly-report';

export interface Its2MatrixProtection {
  smallCountThreshold: number;
  protectedRowIndexes: readonly number[];
  protectTotals: boolean;
}

export interface Its2RenderOptions {
  periodLabel?: string;
  yearLabel?: string;
  preliminaryConsultation?: boolean;
  protection?: Its2MatrixProtection;
}

/**
 * Preliminary ITS-2 matrices are more revealing than a one-dimensional summary.
 * Protecting a complete disease row and every column total prevents reconstructing
 * a small cell by subtracting the remaining visible cells from a published total.
 */
@Injectable()
export class Its2MatrixPrivacyPolicy {
  constructor(private readonly config: ConfigService) {}

  protect(report: ItsMonthlyReport): Its2MatrixProtection {
    const threshold = this.config.get<number>('app.territorialAnalyticsSmallCountThreshold', 5);
    const protectedRowIndexes = report.rows.flatMap((row, index) =>
      threshold > 0 && this.values(row, report).some((value) => value > 0 && value < threshold)
        ? [index]
        : [],
    );
    return {
      smallCountThreshold: threshold,
      protectedRowIndexes,
      protectTotals: protectedRowIndexes.length > 0,
    };
  }

  private values(row: MonthlyReportRow, report: ItsMonthlyReport): number[] {
    const ageValues = [...report.ageGroups]
      .sort((left, right) => left.formatOrder - right.formatOrder)
      .slice(0, 9)
      .flatMap((group) => {
        const value = row.ageGroups[group.code] ?? { male: 0, female: 0 };
        return [value.male, value.female];
      });
    return [
      row.diagnosis.newCases,
      row.diagnosis.controls,
      row.sex.male,
      row.sex.female,
      ...ageValues,
      ...Array.from({ length: Math.max(0, 18 - ageValues.length) }, () => 0),
      row.population.generalMale.newCases,
      row.population.generalMale.controls,
      row.population.generalFemale.newCases,
      row.population.generalFemale.controls,
      row.population.generalPregnant.newCases,
      row.population.generalPregnant.controls,
      row.population.sexWorkerMale.newCases,
      row.population.sexWorkerMale.controls,
      row.population.sexWorkerFemale.newCases,
      row.population.sexWorkerFemale.controls,
      row.population.sexWorkerPregnant.newCases,
      row.population.sexWorkerPregnant.controls,
      row.population.contacts.male,
      row.population.contacts.female,
    ];
  }
}
