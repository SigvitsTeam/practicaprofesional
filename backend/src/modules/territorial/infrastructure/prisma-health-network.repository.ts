import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { HealthNetworkRepository } from '../application/ports/health-network.repository';
import {
  HealthNetworkConcurrencyError,
  HealthNetworkConflictError,
  HealthNetworkNotFoundError,
  HealthNetworkStatusTransitionError,
  InvalidHealthNetworkError,
  type CreateHealthNetworkInput,
  type HealthNetworkSummary,
} from '../domain/health-network';
import { OperationalStatus } from '../domain/region';
import { networkMembershipDate } from '../domain/network-membership-date';

type NetworkRow = Prisma.HealthNetworkGetPayload<{
  include: { region: true; memberships: { include: { municipality: true } } };
}>;

@Injectable()
export class PrismaHealthNetworkRepository extends HealthNetworkRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async list(
    filter: Parameters<HealthNetworkRepository['list']>[0],
  ): Promise<HealthNetworkSummary[]> {
    if (!filter.national && !filter.regionGrantIds.length && !filter.municipalityIds.length)
      return [];
    const membershipWhere = this.membershipAt(filter.asOf);
    const rows = await this.prisma.client.healthNetwork.findMany({
      where: {
        startDate: { lte: filter.asOf },
        ...(filter.national
          ? {}
          : {
              OR: [
                { regionId: { in: [...filter.regionGrantIds] } },
                {
                  memberships: {
                    some: {
                      ...membershipWhere,
                      municipalityId: { in: [...filter.municipalityIds] },
                    },
                  },
                },
              ],
            }),
      },
      include: {
        region: true,
        memberships: {
          where: membershipWhere,
          include: { municipality: true },
          orderBy: { municipality: { name: 'asc' } },
        },
      },
      orderBy: [{ region: { name: 'asc' } }, { name: 'asc' }],
    });
    return rows.map((row) => {
      const scopeLimited = !filter.national && !filter.regionGrantIds.includes(row.regionId);
      return {
        ...this.toDomain({
          ...row,
          memberships: scopeLimited
            ? row.memberships.filter(({ municipalityId }) =>
                filter.municipalityIds.includes(municipalityId),
              )
            : row.memberships,
        }),
        scopeLimited,
        membershipAsOf: filter.asOf,
      };
    });
  }

  resolveRegion(regionId: string): Promise<{ id: string; active: boolean } | null> {
    return this.prisma.client.region.findUnique({
      where: { id: regionId },
      select: { id: true, active: true },
    });
  }

  async validateMunicipalities(
    regionId: string,
    municipalityIds: readonly string[],
  ): Promise<boolean> {
    if (municipalityIds.length === 0) return true;
    const count = await this.prisma.client.municipality.count({
      where: { id: { in: [...municipalityIds] }, regionId, active: true },
    });
    return count === municipalityIds.length;
  }

  async findRegionId(networkId: string): Promise<string | null> {
    return (
      (
        await this.prisma.client.healthNetwork.findUnique({
          where: { id: networkId },
          select: { regionId: true },
        })
      )?.regionId ?? null
    );
  }

  async findStatusContext(networkId: string): Promise<{
    id: string;
    regionId: string;
    operationalStatus: OperationalStatus;
    active: boolean;
    updatedAt: Date;
  } | null> {
    const row = await this.prisma.client.healthNetwork.findUnique({
      where: { id: networkId },
      select: { id: true, regionId: true, operationalStatus: true, active: true, updatedAt: true },
    });
    return row ? { ...row, operationalStatus: row.operationalStatus as OperationalStatus } : null;
  }

  async create(input: CreateHealthNetworkInput): Promise<HealthNetworkSummary> {
    try {
      const row = await this.prisma.client.$transaction(
        async (tx) => {
          const validMunicipalities = await tx.municipality.count({
            where: { id: { in: input.municipalityIds }, regionId: input.regionId, active: true },
          });
          if (validMunicipalities !== input.municipalityIds.length)
            throw new InvalidHealthNetworkError(
              'La composición municipal cambió durante la creación.',
            );
          await this.requireAvailableMemberships(tx, input.municipalityIds, input.startDate);
          const network = await tx.healthNetwork.create({
            data: {
              regionId: input.regionId,
              code: input.code,
              name: input.name,
              description: input.description,
              operationalStatus: input.operationalStatus,
              startDate: input.startDate,
              memberships: {
                create: input.municipalityIds.map((municipalityId) => ({
                  municipalityId,
                  startDate: input.startDate,
                })),
              },
            },
            include: { region: true, memberships: { include: { municipality: true } } },
          });
          await tx.auditEvent.create({
            data: {
              actorUserId: input.audit.actorUserId,
              action: 'HEALTH_NETWORK_CREATED',
              entity: 'HEALTH_NETWORK',
              entityId: network.id,
              dataLevel: 'CONFIGURACION',
              newData: {
                regionId: network.regionId,
                code: network.code,
                name: network.name,
                operationalStatus: network.operationalStatus,
                municipalityIds: input.municipalityIds,
              },
              reason: input.audit.reason,
              requestId: input.audit.requestId,
            },
          });
          return network;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return this.toDomain(row);
    } catch (error: unknown) {
      this.mapError(error, input.code);
    }
  }

  async replaceMunicipalities(input: {
    networkId: string;
    municipalityIds: string[];
    effectiveDate: Date;
    expectedUpdatedAt: Date;
    audit: CreateHealthNetworkInput['audit'];
  }): Promise<HealthNetworkSummary> {
    try {
      await this.prisma.client.$transaction(
        async (tx) => {
          const network = await tx.healthNetwork.findUnique({
            where: { id: input.networkId },
            include: {
              memberships: { where: { programId: null, active: true, endDate: null } },
            },
          });
          if (!network) throw new HealthNetworkNotFoundError('La red no existe.');
          if (input.effectiveDate < network.startDate)
            throw new InvalidHealthNetworkError('La asociación no puede iniciar antes que la red.');
          const valid = await tx.municipality.count({
            where: { id: { in: input.municipalityIds }, regionId: network.regionId, active: true },
          });
          if (valid !== input.municipalityIds.length)
            throw new InvalidHealthNetworkError(
              'La composición contiene municipios inválidos o fuera de la región.',
            );
          const cas = await tx.healthNetwork.updateMany({
            where: { id: input.networkId, updatedAt: input.expectedUpdatedAt },
            data: { updatedAt: new Date() },
          });
          if (cas.count !== 1)
            throw new HealthNetworkConcurrencyError(
              'La red cambió mientras la editaba. Recargue e intente nuevamente.',
            );
          const desired = new Set(input.municipalityIds);
          const current = new Map(
            network.memberships.map((membership) => [membership.municipalityId, membership]),
          );
          const removed = network.memberships.filter(
            (membership) => !desired.has(membership.municipalityId),
          );
          if (removed.some((membership) => input.effectiveDate < membership.startDate))
            throw new InvalidHealthNetworkError(
              'La vigencia no puede finalizar antes de su fecha de inicio.',
            );
          await Promise.all(
            removed.map((membership) =>
              tx.networkMunicipality.update({
                where: { id: membership.id },
                data: { active: false, endDate: input.effectiveDate },
              }),
            ),
          );
          const added = input.municipalityIds.filter(
            (municipalityId) => !current.has(municipalityId),
          );
          await this.requireAvailableMemberships(tx, added, input.effectiveDate);
          if (added.length)
            await tx.networkMunicipality.createMany({
              data: added.map((municipalityId) => ({
                networkId: input.networkId,
                municipalityId,
                startDate: input.effectiveDate,
              })),
            });
          await tx.auditEvent.create({
            data: {
              actorUserId: input.audit.actorUserId,
              action: 'HEALTH_NETWORK_MEMBERSHIPS_CHANGED',
              entity: 'HEALTH_NETWORK',
              entityId: input.networkId,
              dataLevel: 'CONFIGURACION',
              previousData: { municipalityIds: [...current.keys()] },
              newData: {
                municipalityIds: input.municipalityIds,
                effectiveDate: input.effectiveDate,
              },
              reason: input.audit.reason,
              requestId: input.audit.requestId,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return await this.requiredNetwork(input.networkId);
    } catch (error: unknown) {
      this.mapError(error, input.networkId);
    }
  }

  async updateStatus(input: {
    networkId: string;
    status: OperationalStatus;
    expectedUpdatedAt: Date;
    audit: CreateHealthNetworkInput['audit'];
  }): Promise<HealthNetworkSummary> {
    const active = ![OperationalStatus.Inactive, OperationalStatus.Suspended].includes(
      input.status,
    );
    try {
      await this.prisma.client.$transaction(
        async (tx) => {
          const network = await tx.healthNetwork.findUnique({
            where: { id: input.networkId },
            select: {
              operationalStatus: true,
              active: true,
              region: { select: { active: true } },
            },
          });
          if (!network) throw new HealthNetworkNotFoundError('La red no existe.');
          if (active && !network.region.active)
            throw new HealthNetworkStatusTransitionError(
              'La región de la red debe estar activa antes de habilitarla.',
            );
          const updated = await tx.healthNetwork.updateMany({
            where: { id: input.networkId, updatedAt: input.expectedUpdatedAt },
            data: { operationalStatus: input.status, active, updatedAt: new Date() },
          });
          if (updated.count !== 1)
            throw new HealthNetworkConcurrencyError(
              'La red cambió mientras la editaba. Recargue e intente nuevamente.',
            );
          await tx.auditEvent.create({
            data: {
              actorUserId: input.audit.actorUserId,
              action: 'HEALTH_NETWORK_STATUS_CHANGED',
              entity: 'HEALTH_NETWORK',
              entityId: input.networkId,
              dataLevel: 'CONFIGURACION',
              previousData: {
                operationalStatus: network.operationalStatus,
                active: network.active,
              },
              newData: { operationalStatus: input.status, active },
              reason: input.audit.reason,
              requestId: input.audit.requestId,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return await this.requiredNetwork(input.networkId);
    } catch (error: unknown) {
      this.mapError(error, input.networkId);
    }
  }

  private async requiredNetwork(networkId: string): Promise<HealthNetworkSummary> {
    const today = this.today();
    const row = await this.prisma.client.healthNetwork.findUnique({
      where: { id: networkId },
      include: {
        region: true,
        memberships: {
          where: this.membershipAt(today),
          include: { municipality: true },
        },
      },
    });
    if (!row) throw new HealthNetworkNotFoundError('La red no existe.');
    return this.toDomain(row);
  }
  private toDomain(row: NetworkRow): HealthNetworkSummary {
    return {
      id: row.id,
      regionId: row.regionId,
      regionName: row.region.name,
      code: row.code,
      name: row.name,
      description: row.description,
      operationalStatus: row.operationalStatus as OperationalStatus,
      startDate: row.startDate,
      active: row.active,
      municipalities: row.memberships.map(({ municipality, startDate }) => ({
        id: municipality.id,
        code: municipality.officialCode,
        name: municipality.name,
        startDate,
      })),
      updatedAt: row.updatedAt,
    };
  }
  private today(): Date {
    return networkMembershipDate(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Tegucigalpa',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date()),
    );
  }
  private membershipAt(asOf: Date): Prisma.NetworkMunicipalityWhereInput {
    // Closed records remain part of history. active=false with no end date is not a valid grant.
    return {
      programId: null,
      startDate: { lte: asOf },
      OR: [{ active: true, endDate: null }, { endDate: { gt: asOf } }],
    };
  }
  private async requireAvailableMemberships(
    tx: Prisma.TransactionClient,
    municipalityIds: readonly string[],
    startDate: Date,
  ): Promise<void> {
    if (!municipalityIds.length) return;
    // New associations are open-ended. A later or historical overlapping assignment also
    // conflicts, even in another network. Serializable transactions protect competing inserts.
    const conflict = await tx.networkMunicipality.findFirst({
      where: {
        municipalityId: { in: [...municipalityIds] },
        programId: null,
        OR: [{ active: true, endDate: null }, { endDate: { gt: startDate } }],
      },
      select: { id: true },
    });
    if (conflict)
      throw new HealthNetworkConflictError(
        'Un municipio ya tiene una asociación de red que se superpone con la vigencia solicitada. Retire primero la asociación anterior.',
      );
  }
  private mapError(error: unknown, code: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      throw new HealthNetworkConflictError(
        `Ya existe una red o asociación vigente con el código ${code}.`,
      );
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')
      throw new HealthNetworkConcurrencyError(
        'Otra operación modificó la red simultáneamente. Recargue e intente nuevamente.',
      );
    throw error;
  }
}
