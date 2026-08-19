import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { Region as PrismaRegion } from '../../../generated/prisma/client';
import { Prisma } from '../../../generated/prisma/client';
import { RegionRepository } from '../application/ports/region.repository';
import {
  OperationalStatus,
  RegionCodeAlreadyExistsError,
  type AuditContext,
  type NewRegion,
  type Region,
  type RegionType,
} from '../domain/region';

@Injectable()
export class PrismaRegionRepository implements RegionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByCode(code: string): Promise<Region | null> {
    const region = await this.prisma.client.region.findUnique({ where: { code } });
    return region ? this.toDomain(region) : null;
  }

  async create(region: NewRegion, audit: AuditContext): Promise<Region> {
    try {
      const created = await this.prisma.client.$transaction(async (transaction) => {
        const persisted = await transaction.region.create({ data: region });
        await transaction.auditEvent.create({
          data: {
            actorUserId: audit.actorUserId,
            action: 'REGION_CREATED',
            entity: 'REGION',
            entityId: persisted.id,
            dataLevel: 'CONFIGURACION',
            newData: {
              code: persisted.code,
              name: persisted.name,
              regionNumber: persisted.regionNumber,
              type: persisted.type,
              operationalStatus: persisted.operationalStatus,
            },
            reason: audit.reason,
            requestId: audit.requestId,
          },
        });
        return persisted;
      });
      return this.toDomain(created);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new RegionCodeAlreadyExistsError(region.code);
      }
      throw error;
    }
  }

  async listActive(regionIds?: readonly string[]): Promise<Region[]> {
    const regions = await this.prisma.client.region.findMany({
      where: { ...(regionIds ? { id: { in: [...regionIds] } } : {}) },
      orderBy: [{ name: 'asc' }, { code: 'asc' }],
    });
    return regions.map((region) => this.toDomain(region));
  }

  private toDomain(region: PrismaRegion): Region {
    return {
      ...region,
      type: region.type as RegionType,
      operationalStatus: region.operationalStatus as OperationalStatus,
    };
  }
}
