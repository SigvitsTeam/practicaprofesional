import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { TerritorialAnalyticsRepository } from '../application/ports/territorial-analytics.repository';
import type {
  TerritorialAnalyticsLevel,
  TerritorialAnalyticsRow,
  TerritorialAnalyticsScope,
} from '../domain/territorial-analytics';

interface TerritorialMapEntity {
  id: string;
  code: string;
  name: string;
}

interface LocatedFacility {
  latitude: unknown;
  longitude: unknown;
  coordinatesValidated: boolean;
  municipality: { id: string; regionId: string };
}

export function deriveTerritorialCentroids<T extends TerritorialMapEntity>(
  level: 'REGION' | 'MUNICIPIO',
  entities: readonly T[],
  facilities: readonly LocatedFacility[],
): (T & { latitude?: number; longitude?: number; coordinatesValidated?: boolean })[] {
  const totals = new Map<
    string,
    { latitude: number; longitude: number; count: number; allValidated: boolean }
  >();
  for (const facility of facilities) {
    const latitude = Number(facility.latitude);
    const longitude = Number(facility.longitude);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    )
      continue;
    const entityId = level === 'REGION' ? facility.municipality.regionId : facility.municipality.id;
    const total = totals.get(entityId) ?? {
      latitude: 0,
      longitude: 0,
      count: 0,
      allValidated: true,
    };
    total.latitude += latitude;
    total.longitude += longitude;
    total.count += 1;
    total.allValidated &&= facility.coordinatesValidated;
    totals.set(entityId, total);
  }
  return entities.map((entity) => {
    const total = totals.get(entity.id);
    if (!total?.count) return { ...entity };
    return {
      ...entity,
      latitude: total.latitude / total.count,
      longitude: total.longitude / total.count,
      coordinatesValidated: total.allValidated,
    };
  });
}

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
  ): Promise<
    {
      id: string;
      code: string;
      name: string;
      latitude?: number;
      longitude?: number;
      coordinatesValidated?: boolean;
    }[]
  > {
    if (level === 'REGION') {
      const regions = await this.prisma.client.region.findMany({
        where: { active: true, ...(scope.national ? {} : { id: { in: [...scope.regionIds] } }) },
        select: { id: true, code: true, name: true },
        orderBy: { name: 'asc' },
      });
      return this.withDerivedCentroids(level, regions);
    }
    if (level === 'MUNICIPIO') {
      const municipalities = await this.prisma.client.municipality.findMany({
        where: {
          active: true,
          ...(scope.national ? {} : { id: { in: [...scope.municipalityIds] } }),
        },
        select: { id: true, officialCode: true, name: true },
        orderBy: { name: 'asc' },
      });
      return this.withDerivedCentroids(
        level,
        municipalities.map(({ officialCode, ...row }) => ({ ...row, code: officialCode })),
      );
    }
    return this.prisma.client.healthFacility
      .findMany({
        where: {
          active: true,
          ...(scope.national ? {} : { id: { in: [...scope.facilityIds] } }),
        },
        select: {
          id: true,
          code: true,
          name: true,
          latitude: true,
          longitude: true,
          coordinatesValidated: true,
        },
        orderBy: { name: 'asc' },
      })
      .then((rows) =>
        rows.map(({ latitude, longitude, ...row }) => ({
          ...row,
          latitude: latitude === null ? undefined : Number(latitude),
          longitude: longitude === null ? undefined : Number(longitude),
        })),
      );
  }

  /**
   * Regions and municipalities do not store an arbitrary hard-coded point.
   * Their map location is derived from the facilities currently registered in
   * that territory, so the aggregate remains useful as the catalog evolves.
   */
  private async withDerivedCentroids<T extends { id: string; code: string; name: string }>(
    level: 'REGION' | 'MUNICIPIO',
    entities: T[],
  ): Promise<
    (T & {
      latitude?: number;
      longitude?: number;
      coordinatesValidated?: boolean;
    })[]
  > {
    if (!entities.length) return entities;
    const ids = entities.map((entity) => entity.id);
    const facilities = await this.prisma.client.healthFacility.findMany({
      where: {
        active: true,
        latitude: { not: null },
        longitude: { not: null },
        municipality:
          level === 'REGION'
            ? { regionId: { in: ids }, active: true }
            : { id: { in: ids }, active: true },
      },
      select: {
        latitude: true,
        longitude: true,
        coordinatesValidated: true,
        municipality: { select: { id: true, regionId: true } },
      },
    });
    return deriveTerritorialCentroids(level, entities, facilities);
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
