import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { TerritorialAuditRepository } from '../application/ports/territorial-audit.repository';
import type { TerritorialAuditPage } from '../domain/territorial-audit';

@Injectable()
export class PrismaTerritorialAuditRepository extends TerritorialAuditRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findMunicipalityRegion(municipalityId: string): Promise<string | null> {
    const row = await this.prisma.client.municipality.findUnique({
      where: { id: municipalityId },
      select: { regionId: true },
    });
    return row?.regionId ?? null;
  }

  async listMunicipalityEvents(input: {
    municipalityId: string;
    limit: number;
    cursor?: string;
  }): Promise<TerritorialAuditPage> {
    const rows = await this.prisma.client.auditEvent.findMany({
      where: {
        entityId: input.municipalityId,
        entity: { in: ['MUNICIPALITY', 'MUNICIPIO'] },
        dataLevel: 'CONFIGURACION',
      },
      select: {
        id: true,
        action: true,
        entity: true,
        reason: true,
        createdAt: true,
        actor: { select: { fullName: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > input.limit;
    const page = hasMore ? rows.slice(0, input.limit) : rows;
    return {
      items: page.map((row) => ({
        id: row.id,
        action: row.action,
        entity: row.entity,
        reason: row.reason,
        actorName: row.actor?.fullName ?? null,
        createdAt: row.createdAt,
      })),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }
}
