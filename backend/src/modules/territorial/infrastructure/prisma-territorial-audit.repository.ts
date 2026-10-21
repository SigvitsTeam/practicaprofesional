import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { TerritorialAuditRepository } from '../application/ports/territorial-audit.repository';
import type { TerritorialAuditPage } from '../domain/territorial-audit';

@Injectable()
export class PrismaTerritorialAuditRepository extends TerritorialAuditRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findTerritoryRegion(
    type: 'REGION' | 'ESTABLECIMIENTO',
    id: string,
  ): Promise<string | null> {
    if (type === 'REGION') {
      const row = await this.prisma.client.region.findUnique({
        where: { id },
        select: { id: true },
      });
      return row?.id ?? null;
    }
    const row = await this.prisma.client.healthFacility.findUnique({
      where: { id },
      select: { municipality: { select: { regionId: true } } },
    });
    return row?.municipality.regionId ?? null;
  }

  async listTerritoryEvents(input: {
    entityType: 'NACIONAL' | 'REGION' | 'ESTABLECIMIENTO';
    entityId?: string;
    regionIds?: readonly string[];
    limit: number;
    cursor?: string;
  }): Promise<TerritorialAuditPage> {
    if (input.entityType === 'ESTABLECIMIENTO') {
      return this.listEvents({
        entityId: input.entityId!,
        entities: ['HEALTH_FACILITY', 'ESTABLECIMIENTO'],
        limit: input.limit,
        cursor: input.cursor,
      });
    }
    const regions = await this.prisma.client.region.findMany({
      where: {
        ...(input.entityType === 'REGION'
          ? { id: input.entityId }
          : input.regionIds
            ? { id: { in: [...input.regionIds] } }
            : {}),
      },
      select: { id: true },
    });
    const regionIds = regions.map((row) => row.id);
    const municipalities = await this.prisma.client.municipality.findMany({
      where: { regionId: { in: regionIds } },
      select: { id: true },
    });
    const municipalityIds = municipalities.map((row) => row.id);
    const facilities = await this.prisma.client.healthFacility.findMany({
      where: { municipalityId: { in: municipalityIds } },
      select: { id: true },
    });
    return this.queryEvents(
      {
        OR: [
          { entity: 'REGION', entityId: { in: regionIds } },
          { entity: { in: ['MUNICIPALITY', 'MUNICIPIO'] }, entityId: { in: municipalityIds } },
          {
            entity: { in: ['HEALTH_FACILITY', 'ESTABLECIMIENTO'] },
            entityId: { in: facilities.map((row) => row.id) },
          },
        ],
      },
      input.limit,
      input.cursor,
    );
  }

  async findMunicipalityRegion(municipalityId: string): Promise<string | null> {
    const row = await this.prisma.client.municipality.findUnique({
      where: { id: municipalityId },
      select: { regionId: true },
    });
    return row?.regionId ?? null;
  }

  async findNetworkRegion(networkId: string): Promise<string | null> {
    const row = await this.prisma.client.healthNetwork.findUnique({
      where: { id: networkId },
      select: { regionId: true },
    });
    return row?.regionId ?? null;
  }

  async listMunicipalityEvents(input: {
    municipalityId: string;
    limit: number;
    cursor?: string;
  }): Promise<TerritorialAuditPage> {
    return this.listEvents({
      entityId: input.municipalityId,
      entities: ['MUNICIPALITY', 'MUNICIPIO'],
      limit: input.limit,
      cursor: input.cursor,
    });
  }

  async listNetworkEvents(input: {
    networkId: string;
    limit: number;
    cursor?: string;
  }): Promise<TerritorialAuditPage> {
    return this.listEvents({
      entityId: input.networkId,
      entities: ['HEALTH_NETWORK', 'RED_SALUD'],
      limit: input.limit,
      cursor: input.cursor,
    });
  }

  private async listEvents(input: {
    entityId: string;
    entities: string[];
    limit: number;
    cursor?: string;
  }): Promise<TerritorialAuditPage> {
    return this.queryEvents(
      { entityId: input.entityId, entity: { in: input.entities } },
      input.limit,
      input.cursor,
    );
  }

  private async queryEvents(
    where: Prisma.AuditEventWhereInput,
    limit: number,
    cursor?: string,
  ): Promise<TerritorialAuditPage> {
    const rows = await this.prisma.client.auditEvent.findMany({
      where: {
        ...where,
        dataLevel: 'CONFIGURACION',
      },
      select: {
        id: true,
        action: true,
        entity: true,
        reason: true,
        newData: true,
        createdAt: true,
        actor: { select: { fullName: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: page.map((row) => ({
        id: row.id,
        action: row.action,
        entity: row.entity,
        reason: row.reason,
        source:
          row.newData &&
          typeof row.newData === 'object' &&
          !Array.isArray(row.newData) &&
          typeof row.newData['source'] === 'string'
            ? row.newData['source']
            : undefined,
        actorName: row.actor?.fullName ?? null,
        createdAt: row.createdAt,
      })),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }
}
