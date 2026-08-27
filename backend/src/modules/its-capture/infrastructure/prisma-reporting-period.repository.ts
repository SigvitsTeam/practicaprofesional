import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ReportingPeriodRepository } from '../application/ports/reporting-period.repository';
import type { MonthlyReportingPeriod } from '../domain/reporting-period';

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
}
