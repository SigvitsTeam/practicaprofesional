import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ReportingPeriodRepository } from '../application/ports/reporting-period.repository';
import type { EpidemiologicalWeekPeriod, MonthlyReportingPeriod } from '../domain/reporting-period';

@Injectable()
export class PrismaReportingPeriodRepository extends ReportingPeriodRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async listMonthly(limit: number): Promise<readonly MonthlyReportingPeriod[]> {
    const periods = await this.prisma.client.reportingPeriod.findMany({
      where: { type: 'MENSUAL', month: { not: null } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: limit,
      select: {
        id: true,
        year: true,
        month: true,
        startDate: true,
        endDate: true,
        status: true,
      },
    });

    return periods
      .filter((period): period is typeof period & { month: number } => period.month !== null)
      .reverse();
  }

  async listEpidemiologicalWeeks(
    startYear: number,
    endYear: number,
  ): Promise<readonly EpidemiologicalWeekPeriod[]> {
    const weeks = await this.prisma.client.epidemiologicalWeek.findMany({
      where: { year: { gte: startYear, lte: endYear }, active: true },
      orderBy: [{ startDate: 'asc' }, { weekNumber: 'asc' }],
      select: {
        id: true,
        year: true,
        weekNumber: true,
        startDate: true,
        endDate: true,
        active: true,
      },
    });
    return weeks.map((week) => ({
      ...week,
      label: `SE ${String(week.weekNumber).padStart(2, '0')} · ${this.dateLabel(week.startDate)}–${this.dateLabel(week.endDate)}`,
    }));
  }

  private dateLabel(value: Date): string {
    return `${String(value.getUTCDate()).padStart(2, '0')}/${String(value.getUTCMonth() + 1).padStart(2, '0')}/${value.getUTCFullYear()}`;
  }
}
