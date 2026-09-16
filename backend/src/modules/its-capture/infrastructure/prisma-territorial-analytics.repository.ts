import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { TerritorialAnalyticsRepository } from '../application/ports/territorial-analytics.repository';
import type {
  TerritorialAnalyticsLevel,
  TerritorialAnalyticsQuery,
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

interface LiveTerritorialAggregate {
  entityId: string;
  attentions: number;
  newCases: number;
  controls: number;
  sourceUpdatedAt: Date | null;
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

  async list(
    input: TerritorialAnalyticsQuery & {
      scope: TerritorialAnalyticsScope;
    },
  ): Promise<readonly TerritorialAnalyticsRow[]> {
    const period = await this.prisma.client.reportingPeriod.findFirst({
      where: { type: 'MENSUAL', year: input.year, month: input.month },
      select: { id: true, status: true, updatedAt: true },
    });
    const entities = await this.entities(input, period?.id);
    if (!entities.length) return [];
    if (!period)
      return entities.map((entity) => ({
        ...entity,
        status: 'SIN_REPORTE',
        dataStatus: 'PRELIMINAR' as const,
        dataSource: 'ITS1' as const,
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
        sentAt: true,
        _count: { select: { observations: { where: { status: 'ABIERTA' } } } },
      },
    });
    const aggregates = await this.liveIts1Totals(period.id, input.level, entityIds);
    const confirmedPeriod = await this.prisma.client.reportingPeriod.findUnique({
      where: { id: period.id },
      select: { status: true, updatedAt: true },
    });
    const dataStatus =
      period.status === 'CERRADO' &&
      confirmedPeriod?.status === 'CERRADO' &&
      confirmedPeriod.updatedAt.getTime() === period.updatedAt.getTime()
        ? ('OFICIAL' as const)
        : ('PRELIMINAR' as const);
    const liveTotals = new Map(
      aggregates.map((aggregate) => [
        aggregate.entityId,
        {
          attentions: Number(aggregate.attentions),
          newCases: Number(aggregate.newCases),
          controls: Number(aggregate.controls),
          sourceUpdatedAt: aggregate.sourceUpdatedAt ?? undefined,
        },
      ]),
    );
    const reportsByEntity = new Map(
      reports.map((report) => [this.reportEntityId(input.level, report), report]),
    );
    return entities.map((entity) => {
      const report = reportsByEntity.get(entity.id);
      const totals = liveTotals.get(entity.id);
      return {
        ...entity,
        reportId: report?.id,
        reportVersion: report?.version,
        status: report?.status ?? 'SIN_REPORTE',
        dataStatus,
        dataSource: 'ITS1' as const,
        attentions: totals?.attentions ?? 0,
        newCases: totals?.newCases ?? 0,
        controls: totals?.controls ?? 0,
        alerts: report?._count.observations ?? 0,
        sourceUpdatedAt: totals?.sourceUpdatedAt,
        sentAt: report?.sentAt ?? undefined,
      };
    });
  }

  private async entities(
    input: TerritorialAnalyticsQuery & { scope: TerritorialAnalyticsScope },
    periodId?: string,
  ): Promise<
    {
      id: string;
      parentId: string;
      code: string;
      name: string;
      latitude?: number;
      longitude?: number;
      coordinatesValidated?: boolean;
    }[]
  > {
    const { level, scope } = input;
    const availability = periodId
      ? {
          OR: [
            { active: true },
            { attentions: { some: { monthlyPeriodId: periodId, status: 'ACTIVO' as const } } },
          ],
        }
      : { active: true };
    if (level === 'REGION') {
      const regions = await this.prisma.client.region.findMany({
        where: {
          ...availability,
          ...(scope.national ? {} : { id: { in: [...scope.regionIds] } }),
        },
        select: { id: true, code: true, name: true },
        orderBy: { name: 'asc' },
      });
      return this.withDerivedCentroids(
        level,
        regions.map((region) => ({ ...region, parentId: 'HONDURAS' })),
        periodId,
      );
    }
    if (level === 'MUNICIPIO') {
      const municipalities = await this.prisma.client.municipality.findMany({
        where: {
          ...(input.regionId ? { regionId: input.regionId } : {}),
          AND: [
            availability,
            ...(scope.national
              ? []
              : [
                  {
                    OR: [
                      {
                        id: {
                          in: [...(scope.municipalityScopeIds ?? scope.municipalityGrantIds ?? [])],
                        },
                      },
                      { regionId: { in: [...(scope.regionGrantIds ?? [])] } },
                    ],
                  },
                ]),
          ],
        },
        select: { id: true, regionId: true, officialCode: true, name: true },
        orderBy: { name: 'asc' },
      });
      return this.withDerivedCentroids(
        level,
        municipalities.map(({ officialCode, regionId, ...row }) => ({
          ...row,
          parentId: regionId,
          code: officialCode,
        })),
        periodId,
      );
    }
    return this.prisma.client.healthFacility
      .findMany({
        where: {
          ...(input.municipalityId ? { municipalityId: input.municipalityId } : {}),
          AND: [
            availability,
            ...(scope.national
              ? []
              : [
                  {
                    OR: [
                      { id: { in: [...scope.facilityIds] } },
                      { municipalityId: { in: [...(scope.municipalityGrantIds ?? [])] } },
                      {
                        municipality: {
                          regionId: { in: [...(scope.regionGrantIds ?? [])] },
                        },
                      },
                    ],
                  },
                ]),
          ],
        },
        select: {
          id: true,
          municipalityId: true,
          code: true,
          name: true,
          latitude: true,
          longitude: true,
          coordinatesValidated: true,
        },
        orderBy: { name: 'asc' },
      })
      .then((rows) =>
        rows.map(({ latitude, longitude, municipalityId, ...row }) => ({
          ...row,
          parentId: municipalityId,
          latitude: latitude === null ? undefined : Number(latitude),
          longitude: longitude === null ? undefined : Number(longitude),
        })),
      );
  }

  /**
   * Regions and municipalities do not store an arbitrary hard-coded point.
   * Their map location is derived from current facilities plus any historical
   * facility that contributed active ITS-1 data to the requested period.
   */
  private async withDerivedCentroids<T extends { id: string; code: string; name: string }>(
    level: 'REGION' | 'MUNICIPIO',
    entities: T[],
    periodId?: string,
  ): Promise<
    (T & {
      latitude?: number;
      longitude?: number;
      coordinatesValidated?: boolean;
    })[]
  > {
    if (!entities.length) return entities;
    const ids = entities.map((entity) => entity.id);
    const availability = periodId
      ? {
          OR: [
            { active: true },
            { attentions: { some: { monthlyPeriodId: periodId, status: 'ACTIVO' as const } } },
          ],
        }
      : { active: true };
    const facilities = await this.prisma.client.healthFacility.findMany({
      where: {
        ...availability,
        latitude: { not: null },
        longitude: { not: null },
        municipality: level === 'REGION' ? { regionId: { in: ids } } : { id: { in: ids } },
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

  private liveIts1Totals(
    periodId: string,
    level: TerritorialAnalyticsLevel,
    entityIds: readonly string[],
  ): Promise<LiveTerritorialAggregate[]> {
    const entityColumn = this.attentionTerritoryColumn(level);
    const ids = Prisma.join(entityIds.map((id) => Prisma.sql`${id}::uuid`));
    return this.prisma.client.$queryRaw<LiveTerritorialAggregate[]>(Prisma.sql`
      SELECT
        ${entityColumn} AS "entityId",
        COUNT(DISTINCT a.id)::integer AS attentions,
        COUNT(d.id) FILTER (WHERE d.tipo_caso = 'NUEVO')::integer AS "newCases",
        COUNT(d.id) FILTER (WHERE d.tipo_caso = 'CONTROL')::integer AS controls,
        MAX(a.updated_at) AS "sourceUpdatedAt"
      FROM atenciones_its a
      LEFT JOIN diagnosticos_atencion d ON d.atencion_id = a.id
      WHERE a.periodo_mensual_id = ${periodId}::uuid
        AND a.estado = 'ACTIVO'
        AND ${entityColumn} IN (${ids})
      GROUP BY ${entityColumn}
    `);
  }

  private attentionTerritoryColumn(level: TerritorialAnalyticsLevel): Prisma.Sql {
    if (level === 'REGION') return Prisma.sql`a.region_id`;
    if (level === 'MUNICIPIO') return Prisma.sql`a.municipio_id`;
    return Prisma.sql`a.establecimiento_atencion_id`;
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
