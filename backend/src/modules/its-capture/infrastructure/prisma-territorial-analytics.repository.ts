import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { TerritorialAnalyticsRepository } from '../application/ports/territorial-analytics.repository';
import type {
  TerritorialAnalyticsLevel,
  TerritorialAnalyticsRow,
  TerritorialAnalyticsScope,
} from '../domain/territorial-analytics';

@Injectable()
export class PrismaTerritorialAnalyticsRepository extends TerritorialAnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async list(input: {
    level: TerritorialAnalyticsLevel;
    year: number;
    month: number;
    scope: TerritorialAnalyticsScope;
  }): Promise<readonly TerritorialAnalyticsRow[]> {
    const entities = await this.entities(input.level, input.scope);
    if (!entities.length) return [];
    const period = await this.prisma.client.reportingPeriod.findFirst({
      where: { type: 'MENSUAL', year: input.year, month: input.month },
      select: { id: true },
    });
    if (!period)
      return entities.map((entity) => ({
        ...entity,
        status: 'SIN_REPORTE',
        attentions: 0,
        newCases: 0,
        controls: 0,
        alerts: 0,
      }));

    const entityIds = entities.map((entity) => entity.id);
    const reports = await this.prisma.client.itsReport.findMany({
      where: {
        periodId: period.id,
        level: this.reportLevel(input.level),
        isCurrentVersion: true,
        ...this.reportTerritory(input.level, entityIds),
      },
      select: {
        id: true,
        regionId: true,
        municipalityId: true,
        facilityId: true,
        status: true,
        version: true,
        sourceAttentionCount: true,
        sentAt: true,
        _count: { select: { observations: { where: { status: 'ABIERTA' } } } },
      },
    });
    const detailTotals = reports.length
      ? await this.prisma.client.itsReportDetail.groupBy({
          by: ['reportId', 'caseType'],
          where: { reportId: { in: reports.map((report) => report.id) }, caseType: { not: null } },
          _sum: { total: true },
        })
      : [];
    const cases = new Map<string, { newCases: number; controls: number }>();
    for (const detail of detailTotals) {
      const current = cases.get(detail.reportId) ?? { newCases: 0, controls: 0 };
      if (detail.caseType === 'NUEVO') current.newCases += detail._sum.total ?? 0;
      if (detail.caseType === 'CONTROL') current.controls += detail._sum.total ?? 0;
      cases.set(detail.reportId, current);
    }
    const reportsByEntity = new Map(
      reports.map((report) => [this.reportEntityId(input.level, report), report]),
    );
    return entities.map((entity) => {
      const report = reportsByEntity.get(entity.id);
      const totals = report ? cases.get(report.id) : undefined;
      return {
        ...entity,
        reportId: report?.id,
        reportVersion: report?.version,
        status: report?.status ?? 'SIN_REPORTE',
        attentions: report?.sourceAttentionCount ?? 0,
        newCases: totals?.newCases ?? 0,
        controls: totals?.controls ?? 0,
        alerts: report?._count.observations ?? 0,
        sentAt: report?.sentAt ?? undefined,
      };
    });
  }

  private async entities(
    level: TerritorialAnalyticsLevel,
    scope: TerritorialAnalyticsScope,
  ): Promise<{ id: string; code: string; name: string }[]> {
    if (level === 'REGION')
      return this.prisma.client.region.findMany({
        where: { active: true, ...(scope.national ? {} : { id: { in: [...scope.regionIds] } }) },
        select: { id: true, code: true, name: true },
        orderBy: { name: 'asc' },
      });
    if (level === 'MUNICIPIO')
      return this.prisma.client.municipality
        .findMany({
          where: {
            active: true,
            ...(scope.national ? {} : { id: { in: [...scope.municipalityIds] } }),
          },
          select: { id: true, officialCode: true, name: true },
          orderBy: { name: 'asc' },
        })
        .then((rows) => rows.map(({ officialCode, ...row }) => ({ ...row, code: officialCode })));
    return this.prisma.client.healthFacility.findMany({
      where: { active: true, ...(scope.national ? {} : { id: { in: [...scope.facilityIds] } }) },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  private reportLevel(
    level: TerritorialAnalyticsLevel,
  ): 'REGIONAL' | 'MUNICIPAL' | 'ESTABLECIMIENTO' {
    return level === 'REGION'
      ? ('REGIONAL' as const)
      : level === 'MUNICIPIO'
        ? ('MUNICIPAL' as const)
        : ('ESTABLECIMIENTO' as const);
  }

  private reportTerritory(
    level: TerritorialAnalyticsLevel,
    ids: string[],
  ):
    | { regionId: { in: string[] } }
    | { municipalityId: { in: string[] } }
    | { facilityId: { in: string[] } } {
    return level === 'REGION'
      ? { regionId: { in: ids } }
      : level === 'MUNICIPIO'
        ? { municipalityId: { in: ids } }
        : { facilityId: { in: ids } };
  }

  private reportEntityId(
    level: TerritorialAnalyticsLevel,
    report: { regionId: string | null; municipalityId: string | null; facilityId: string | null },
  ): string {
    return (
      level === 'REGION'
        ? report.regionId
        : level === 'MUNICIPIO'
          ? report.municipalityId
          : report.facilityId
    ) as string;
  }
}
