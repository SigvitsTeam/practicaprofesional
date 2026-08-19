import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { TerritorialCatalogRepository } from '../application/ports/territorial-catalog.repository';
import { OperationalStatus } from '../domain/region';
import {
  TerritorialCodeAlreadyExistsError,
  type CreateFacilityInput,
  type CreateMunicipalityInput,
  type FacilitySummary,
  type MunicipalitySummary,
} from '../domain/territorial-catalog';

@Injectable()
export class PrismaTerritorialCatalogRepository extends TerritorialCatalogRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async listMunicipalities(regionIds?: readonly string[]): Promise<MunicipalitySummary[]> {
    const rows = await this.prisma.client.municipality.findMany({
      where: { active: true, ...(regionIds ? { regionId: { in: [...regionIds] } } : {}) },
      include: { region: { select: { name: true } }, _count: { select: { facilities: true } } },
      orderBy: [{ region: { name: 'asc' } }, { name: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      regionId: row.regionId,
      regionName: row.region.name,
      officialCode: row.officialCode,
      name: row.name,
      operationalStatus: row.operationalStatus as OperationalStatus,
      mapValidated: row.mapValidated,
      active: row.active,
      facilityCount: row._count.facilities,
    }));
  }

  async listFacilities(municipalityIds?: readonly string[]): Promise<FacilitySummary[]> {
    if (municipalityIds && municipalityIds.length === 0) return [];
    const rows = await this.prisma.client.healthFacility.findMany({
      where: {
        active: true,
        ...(municipalityIds ? { municipalityId: { in: [...municipalityIds] } } : {}),
      },
      include: { municipality: { select: { name: true } } },
      orderBy: [{ municipality: { name: 'asc' } }, { name: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      municipalityId: row.municipalityId,
      municipalityName: row.municipality.name,
      code: row.code,
      name: row.name,
      type: row.type,
      address: row.address,
      operationalStatus: row.operationalStatus as OperationalStatus,
      coordinatesValidated: row.coordinatesValidated,
      active: row.active,
    }));
  }

  findRegion(regionId: string): Promise<{ id: string; active: boolean } | null> {
    return this.prisma.client.region.findUnique({
      where: { id: regionId },
      select: { id: true, active: true },
    });
  }

  findMunicipality(
    municipalityId: string,
  ): Promise<{ id: string; regionId: string; active: boolean } | null> {
    return this.prisma.client.municipality.findUnique({
      where: { id: municipalityId },
      select: { id: true, regionId: true, active: true },
    });
  }

  async createMunicipality(input: CreateMunicipalityInput): Promise<MunicipalitySummary> {
    try {
      const row = await this.prisma.client.$transaction(async (tx) => {
        const municipality = await tx.municipality.create({
          data: {
            regionId: input.regionId,
            officialCode: input.officialCode,
            name: input.name,
          },
          include: { region: { select: { name: true } }, _count: { select: { facilities: true } } },
        });
        await tx.auditEvent.create({
          data: {
            actorUserId: input.audit.actorUserId,
            action: 'MUNICIPALITY_CREATED',
            entity: 'MUNICIPALITY',
            entityId: municipality.id,
            dataLevel: 'CONFIGURACION',
            newData: {
              regionId: municipality.regionId,
              officialCode: municipality.officialCode,
              name: municipality.name,
            },
            reason: input.audit.reason,
            requestId: input.audit.requestId,
          },
        });
        return municipality;
      });
      return {
        id: row.id,
        regionId: row.regionId,
        regionName: row.region.name,
        officialCode: row.officialCode,
        name: row.name,
        operationalStatus: row.operationalStatus as OperationalStatus,
        mapValidated: row.mapValidated,
        active: row.active,
        facilityCount: row._count.facilities,
      };
    } catch (error: unknown) {
      this.mapDuplicate(error, input.officialCode);
      throw error;
    }
  }

  async createFacility(input: CreateFacilityInput): Promise<FacilitySummary> {
    try {
      const row = await this.prisma.client.$transaction(async (tx) => {
        const facility = await tx.healthFacility.create({
          data: {
            municipalityId: input.municipalityId,
            code: input.code,
            name: input.name,
            type: input.type,
            address: input.address,
          },
          include: { municipality: { select: { name: true } } },
        });
        await tx.auditEvent.create({
          data: {
            actorUserId: input.audit.actorUserId,
            action: 'FACILITY_CREATED',
            entity: 'HEALTH_FACILITY',
            entityId: facility.id,
            dataLevel: 'CONFIGURACION',
            newData: {
              municipalityId: facility.municipalityId,
              code: facility.code,
              name: facility.name,
              type: facility.type,
            },
            reason: input.audit.reason,
            requestId: input.audit.requestId,
          },
        });
        return facility;
      });
      return {
        id: row.id,
        municipalityId: row.municipalityId,
        municipalityName: row.municipality.name,
        code: row.code,
        name: row.name,
        type: row.type,
        address: row.address,
        operationalStatus: row.operationalStatus as OperationalStatus,
        coordinatesValidated: row.coordinatesValidated,
        active: row.active,
      };
    } catch (error: unknown) {
      this.mapDuplicate(error, input.code);
      throw error;
    }
  }

  private mapDuplicate(error: unknown, code: string): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      throw new TerritorialCodeAlreadyExistsError(code);
  }
}
