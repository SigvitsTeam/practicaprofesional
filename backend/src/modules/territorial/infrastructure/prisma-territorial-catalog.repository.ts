import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { TerritorialCatalogRepository } from '../application/ports/territorial-catalog.repository';
import { OperationalStatus } from '../domain/region';
import {
  TerritorialConcurrencyError,
  TerritorialEntityNotFoundError,
  TerritorialStatusTransitionError,
  TerritorialCodeAlreadyExistsError,
  type CreateFacilityInput,
  type CreateMunicipalityInput,
  type FacilitySummary,
  type MunicipalitySummary,
  type TerritorialEntityType,
  type TerritorialStatusContext,
} from '../domain/territorial-catalog';

@Injectable()
export class PrismaTerritorialCatalogRepository extends TerritorialCatalogRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async listMunicipalities(regionIds?: readonly string[]): Promise<MunicipalitySummary[]> {
    const rows = await this.prisma.client.municipality.findMany({
      where: { ...(regionIds ? { regionId: { in: [...regionIds] } } : {}) },
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
      updatedAt: row.updatedAt,
    }));
  }

  async listFacilities(municipalityIds?: readonly string[]): Promise<FacilitySummary[]> {
    if (municipalityIds && municipalityIds.length === 0) return [];
    const rows = await this.prisma.client.healthFacility.findMany({
      where: {
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
      updatedAt: row.updatedAt,
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
        updatedAt: row.updatedAt,
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
        updatedAt: row.updatedAt,
      };
    } catch (error: unknown) {
      this.mapDuplicate(error, input.code);
      throw error;
    }
  }

  async findStatusContext(
    entityType: TerritorialEntityType,
    id: string,
  ): Promise<TerritorialStatusContext | null> {
    if (entityType === 'REGION') {
      const row = await this.prisma.client.region.findUnique({
        where: { id },
        select: { id: true, operationalStatus: true, active: true, updatedAt: true },
      });
      return row
        ? {
            ...row,
            entityType,
            regionId: row.id,
            operationalStatus: row.operationalStatus as OperationalStatus,
          }
        : null;
    }
    if (entityType === 'MUNICIPIO') {
      const row = await this.prisma.client.municipality.findUnique({
        where: { id },
        select: {
          id: true,
          regionId: true,
          operationalStatus: true,
          active: true,
          updatedAt: true,
        },
      });
      return row
        ? { ...row, entityType, operationalStatus: row.operationalStatus as OperationalStatus }
        : null;
    }
    const row = await this.prisma.client.healthFacility.findUnique({
      where: { id },
      select: {
        id: true,
        operationalStatus: true,
        active: true,
        updatedAt: true,
        municipality: { select: { regionId: true } },
      },
    });
    return row
      ? {
          id: row.id,
          entityType,
          regionId: row.municipality.regionId,
          operationalStatus: row.operationalStatus as OperationalStatus,
          active: row.active,
          updatedAt: row.updatedAt,
        }
      : null;
  }

  async updateStatus(input: {
    entityType: TerritorialEntityType;
    id: string;
    status: OperationalStatus;
    expectedUpdatedAt: Date;
    audit: CreateMunicipalityInput['audit'];
  }): Promise<TerritorialStatusContext> {
    const active = ![OperationalStatus.Inactive, OperationalStatus.Suspended].includes(
      input.status,
    );
    try {
      await this.prisma.client.$transaction(
        async (tx) => {
          if (!active) await this.assertCanDisable(tx, input.entityType, input.id);
          else await this.assertParentActive(tx, input.entityType, input.id);

          const data = { operationalStatus: input.status, active, updatedAt: new Date() };
          const updated =
            input.entityType === 'REGION'
              ? await tx.region.updateMany({
                  where: { id: input.id, updatedAt: input.expectedUpdatedAt },
                  data,
                })
              : input.entityType === 'MUNICIPIO'
                ? await tx.municipality.updateMany({
                    where: { id: input.id, updatedAt: input.expectedUpdatedAt },
                    data,
                  })
                : await tx.healthFacility.updateMany({
                    where: { id: input.id, updatedAt: input.expectedUpdatedAt },
                    data,
                  });
          if (updated.count !== 1)
            throw new TerritorialConcurrencyError(
              'El territorio cambió mientras lo editaba. Recargue e intente nuevamente.',
            );
          await tx.auditEvent.create({
            data: {
              actorUserId: input.audit.actorUserId,
              action: 'TERRITORIAL_STATUS_CHANGED',
              entity: input.entityType,
              entityId: input.id,
              dataLevel: 'CONFIGURACION',
              newData: { operationalStatus: input.status, active },
              reason: input.audit.reason,
              requestId: input.audit.requestId,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')
        throw new TerritorialConcurrencyError(
          'Otra operación modificó el territorio simultáneamente. Recargue e intente nuevamente.',
        );
      throw error;
    }
    const context = await this.findStatusContext(input.entityType, input.id);
    if (!context) throw new TerritorialEntityNotFoundError('El territorio no existe.');
    return context;
  }

  private async assertCanDisable(
    tx: Prisma.TransactionClient,
    entityType: TerritorialEntityType,
    id: string,
  ): Promise<void> {
    if (entityType === 'REGION') {
      const [municipalities, networks, assignments] = await Promise.all([
        tx.municipality.count({ where: { regionId: id, active: true } }),
        tx.healthNetwork.count({ where: { regionId: id, active: true } }),
        tx.userTerritorialAssignment.count({
          where: { regionId: id, active: true, endDate: null },
        }),
      ]);
      if (municipalities || networks || assignments)
        throw new TerritorialStatusTransitionError(
          'La región tiene municipios, redes o usuarios activos. Desactívelos primero.',
        );
      return;
    }
    if (entityType === 'MUNICIPIO') {
      const [facilities, assignments, reports] = await Promise.all([
        tx.healthFacility.count({ where: { municipalityId: id, active: true } }),
        tx.userTerritorialAssignment.count({
          where: { municipalityId: id, active: true, endDate: null },
        }),
        tx.itsReport.count({
          where: { municipalityId: id, isCurrentVersion: true, period: { status: 'ABIERTO' } },
        }),
      ]);
      if (facilities || assignments || reports)
        throw new TerritorialStatusTransitionError(
          'El municipio tiene establecimientos, usuarios o reportes abiertos. Resuélvalos primero.',
        );
      return;
    }
    const [assignments, reports] = await Promise.all([
      tx.userTerritorialAssignment.count({
        where: { facilityId: id, active: true, endDate: null },
      }),
      tx.itsReport.count({
        where: { facilityId: id, isCurrentVersion: true, period: { status: 'ABIERTO' } },
      }),
    ]);
    if (assignments || reports)
      throw new TerritorialStatusTransitionError(
        'El establecimiento tiene usuarios asignados o reportes abiertos.',
      );
  }

  private async assertParentActive(
    tx: Prisma.TransactionClient,
    entityType: TerritorialEntityType,
    id: string,
  ): Promise<void> {
    if (entityType === 'REGION') return;
    if (entityType === 'MUNICIPIO') {
      const row = await tx.municipality.findUnique({
        where: { id },
        select: { region: { select: { active: true } } },
      });
      if (!row) throw new TerritorialEntityNotFoundError('El municipio no existe.');
      if (!row.region.active)
        throw new TerritorialStatusTransitionError('La región padre debe estar activa.');
      return;
    }
    const row = await tx.healthFacility.findUnique({
      where: { id },
      select: { municipality: { select: { active: true, region: { select: { active: true } } } } },
    });
    if (!row) throw new TerritorialEntityNotFoundError('El establecimiento no existe.');
    if (!row.municipality.active || !row.municipality.region.active)
      throw new TerritorialStatusTransitionError(
        'El municipio y la región padre deben estar activos.',
      );
  }

  private mapDuplicate(error: unknown, code: string): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      throw new TerritorialCodeAlreadyExistsError(code);
  }
}
