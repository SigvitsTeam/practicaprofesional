import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  RoleCode,
  type TerritorialScopeType,
} from '../../authorization/domain/authorization.types';
import {
  ManagedUserConcurrencyError,
  ManagedUserConflictError,
  ManagedUserInvariantError,
  ManagedUserNotFoundError,
  type LinkExternalIdentityInput,
  type CreateManagedUserInput,
  type ManagedUser,
  type ManagedUserContext,
} from '../domain/managed-user';
import { ManagedUserRepository } from '../application/ports/managed-user.repository';

type ManagedUserRow = Prisma.AppUserGetPayload<{
  include: {
    externalIdentities: true;
    roles: { include: { role: true } };
    assignments: {
      include: { region: true; municipality: true; facility: { include: { municipality: true } } };
    };
  };
}>;

@Injectable()
export class PrismaManagedUserRepository extends ManagedUserRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async list(regionIds?: readonly string[]): Promise<ManagedUser[]> {
    if (regionIds && regionIds.length === 0) return [];
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const current = {
      active: true,
      startDate: { lte: today },
      OR: [{ endDate: null }, { endDate: { gte: today } }],
    };
    const rows = await this.prisma.client.appUser.findMany({
      where: regionIds
        ? {
            assignments: {
              some: {
                active: true,
                startDate: { lte: today },
                AND: [
                  { OR: [{ endDate: null }, { endDate: { gte: today } }] },
                  {
                    OR: [
                      { regionId: { in: [...regionIds] } },
                      { municipality: { regionId: { in: [...regionIds] } } },
                      { facility: { municipality: { regionId: { in: [...regionIds] } } } },
                    ],
                  },
                ],
              },
            },
          }
        : undefined,
      include: {
        externalIdentities: { take: 1 },
        roles: { where: current, include: { role: true }, orderBy: { startDate: 'desc' }, take: 1 },
        assignments: {
          where: current,
          include: {
            region: true,
            municipality: true,
            facility: { include: { municipality: true } },
          },
          orderBy: { startDate: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ fullName: 'asc' }, { email: 'asc' }],
    });
    return rows.flatMap((row) => (row.roles[0] && row.assignments[0] ? [this.toDomain(row)] : []));
  }

  async roleExists(code: RoleCode): Promise<boolean> {
    return Boolean(
      await this.prisma.client.role.findFirst({
        where: { code, active: true },
        select: { id: true },
      }),
    );
  }

  async resolveTerritory(input: {
    scopeType: TerritorialScopeType;
    regionId: string | null;
    municipalityId: string | null;
    facilityId: string | null;
  }): Promise<{ regionId: string | null; label: string } | null> {
    if (input.scopeType === 'NACIONAL')
      return !input.regionId && !input.municipalityId && !input.facilityId
        ? { regionId: null, label: 'Honduras' }
        : null;
    if (
      input.scopeType === 'REGION' &&
      input.regionId &&
      !input.municipalityId &&
      !input.facilityId
    ) {
      const row = await this.prisma.client.region.findFirst({
        where: { id: input.regionId, active: true },
        select: { id: true, name: true },
      });
      return row ? { regionId: row.id, label: row.name } : null;
    }
    if (
      input.scopeType === 'MUNICIPIO' &&
      input.municipalityId &&
      !input.regionId &&
      !input.facilityId
    ) {
      const row = await this.prisma.client.municipality.findFirst({
        where: { id: input.municipalityId, active: true },
        select: { name: true, regionId: true },
      });
      return row ? { regionId: row.regionId, label: row.name } : null;
    }
    if (
      input.scopeType === 'ESTABLECIMIENTO' &&
      input.facilityId &&
      !input.regionId &&
      !input.municipalityId
    ) {
      const row = await this.prisma.client.healthFacility.findFirst({
        where: { id: input.facilityId, active: true },
        select: { name: true, municipality: { select: { regionId: true } } },
      });
      return row ? { regionId: row.municipality.regionId, label: row.name } : null;
    }
    return null;
  }

  async create(input: CreateManagedUserInput): Promise<ManagedUser> {
    try {
      const row = await this.prisma.client.$transaction(async (tx) => {
        const role = await tx.role.findUniqueOrThrow({ where: { code: input.roleCode } });
        const user = await tx.appUser.create({
          data: { fullName: input.fullName, email: input.email, phone: input.phone, active: false },
        });
        const userRole = await tx.userRole.create({
          data: { userId: user.id, roleId: role.id, startDate: input.startDate },
        });
        const assignment = await tx.userTerritorialAssignment.create({
          data: {
            userId: user.id,
            scopeType: input.scopeType,
            regionId: input.regionId,
            municipalityId: input.municipalityId,
            facilityId: input.facilityId,
            startDate: input.startDate,
          },
        });
        await tx.auditEvent.create({
          data: {
            actorUserId: input.actorUserId,
            action: 'USER_PROFILE_CREATED',
            entity: 'USER',
            entityId: user.id,
            dataLevel: 'CONFIGURACION',
            newData: {
              email: user.email,
              roleCode: role.code,
              scopeType: assignment.scopeType,
              regionId: assignment.regionId,
              municipalityId: assignment.municipalityId,
              facilityId: assignment.facilityId,
              active: user.active,
            },
            reason: input.reason,
            requestId: input.requestId,
          },
        });
        return { user, role, userRole, assignment };
      });
      const target = await this.resolveTerritory(input);
      return {
        id: row.user.id,
        fullName: row.user.fullName,
        email: row.user.email,
        phone: row.user.phone,
        active: row.user.active,
        hasExternalIdentity: false,
        role: {
          code: row.role.code as RoleCode,
          name: row.role.name,
          startDate: row.userRole.startDate,
        },
        assignment: {
          scopeType: row.assignment.scopeType,
          regionId: row.assignment.regionId,
          municipalityId: row.assignment.municipalityId,
          facilityId: row.assignment.facilityId,
          label: target?.label ?? '',
          startDate: row.assignment.startDate,
        },
        createdAt: row.user.createdAt,
        updatedAt: row.user.updatedAt,
      };
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ManagedUserConflictError('Ya existe un usuario con ese correo electrónico.');
      throw error;
    }
  }

  async findContext(userId: string): Promise<ManagedUserContext | null> {
    const row = await this.findCurrentUser(userId);
    if (!row || !row.roles[0] || !row.assignments[0]) return null;
    const assignment = row.assignments[0];
    return {
      id: row.id,
      email: row.email,
      active: row.active,
      hasExternalIdentity: row.externalIdentities.length > 0,
      roleCode: row.roles[0].role.code as RoleCode,
      regionId:
        assignment.regionId ??
        assignment.municipality?.regionId ??
        assignment.facility?.municipality.regionId ??
        null,
      updatedAt: row.updatedAt,
    };
  }

  async linkExternalIdentity(input: LinkExternalIdentityInput): Promise<ManagedUser> {
    try {
      const idempotent = await this.prisma.client.$transaction(
        async (tx) => {
          const user = await tx.appUser.findUnique({
            where: { id: input.userId },
            select: {
              id: true,
              email: true,
              active: true,
              updatedAt: true,
              externalIdentities: { select: { issuer: true, subject: true } },
            },
          });
          if (!user) throw new ManagedUserNotFoundError('El usuario no existe.');
          const claimed = await tx.externalIdentity.findUnique({
            where: { issuer_subject: { issuer: input.issuer, subject: input.subject } },
            select: { userId: true },
          });
          const sameIdentity = user.externalIdentities.some(
            (identity) => identity.issuer === input.issuer && identity.subject === input.subject,
          );
          if (sameIdentity && claimed?.userId === user.id && user.active === input.activate)
            return true;
          if (user.externalIdentities.length > 0)
            throw new ManagedUserInvariantError(
              'El perfil ya está vinculado a otra identidad externa.',
            );
          if (claimed)
            throw new ManagedUserConflictError(
              'La identidad externa ya está vinculada a otro perfil.',
            );
          const updated = await tx.appUser.updateMany({
            where: { id: user.id, updatedAt: input.expectedUpdatedAt },
            data: { active: input.activate, updatedAt: new Date() },
          });
          if (updated.count !== 1)
            throw new ManagedUserConcurrencyError(
              'El usuario cambió mientras vinculaba la identidad. Recargue e intente nuevamente.',
            );
          await tx.externalIdentity.create({
            data: {
              userId: user.id,
              issuer: input.issuer,
              subject: input.subject,
              emailSnapshot: user.email,
            },
          });
          await tx.auditEvent.create({
            data: {
              actorUserId: input.actorUserId,
              action: 'USER_EXTERNAL_IDENTITY_LINKED',
              entity: 'USER',
              entityId: user.id,
              dataLevel: 'CONFIGURACION',
              previousData: { hasExternalIdentity: false, active: user.active },
              newData: {
                hasExternalIdentity: true,
                active: input.activate,
                issuer: input.issuer,
              },
              reason: input.reason,
              requestId: input.requestId,
            },
          });
          return false;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      if (idempotent) return this.requiredCurrentUser(input.userId);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ManagedUserConflictError(
          'La identidad externa ya fue vinculada por otra operación.',
        );
      this.mapTransactionConflict(error);
    }
    return this.requiredCurrentUser(input.userId);
  }

  async countActiveSuperAdmins(): Promise<number> {
    const today = this.today();
    return this.prisma.client.appUser.count({
      where: {
        active: true,
        externalIdentities: { some: {} },
        roles: {
          some: {
            active: true,
            startDate: { lte: today },
            OR: [{ endDate: null }, { endDate: { gte: today } }],
            role: { code: RoleCode.SuperAdmin, active: true },
          },
        },
      },
    });
  }

  async updateStatus(input: {
    userId: string;
    active: boolean;
    expectedUpdatedAt: Date;
    actorUserId: string;
    requestId: string;
    reason: string;
  }): Promise<ManagedUser> {
    await this.prisma.client
      .$transaction(
        async (tx) => {
          const today = this.today();
          const current = await tx.appUser.findUnique({
            where: { id: input.userId },
            select: {
              active: true,
              roles: {
                where: {
                  active: true,
                  startDate: { lte: today },
                  OR: [{ endDate: null }, { endDate: { gte: today } }],
                },
                select: { role: { select: { code: true } } },
                take: 1,
              },
            },
          });
          if (!current) throw new ManagedUserNotFoundError('El usuario no existe.');
          if (!input.active && current.roles[0]?.role.code === RoleCode.SuperAdmin) {
            const activeSuperAdmins = await tx.appUser.count({
              where: {
                active: true,
                externalIdentities: { some: {} },
                roles: {
                  some: {
                    active: true,
                    startDate: { lte: today },
                    OR: [{ endDate: null }, { endDate: { gte: today } }],
                    role: { code: RoleCode.SuperAdmin, active: true },
                  },
                },
              },
            });
            if (activeSuperAdmins <= 1)
              throw new ManagedUserInvariantError(
                'No se puede suspender al último SuperAdmin activo.',
              );
          }
          const updated = await tx.appUser.updateMany({
            where: { id: input.userId, updatedAt: input.expectedUpdatedAt },
            data: { active: input.active, updatedAt: new Date() },
          });
          if (updated.count !== 1)
            throw new ManagedUserConcurrencyError(
              'El usuario cambió mientras lo editaba. Recargue e intente nuevamente.',
            );
          await tx.auditEvent.create({
            data: {
              actorUserId: input.actorUserId,
              action: input.active ? 'USER_REACTIVATED' : 'USER_SUSPENDED',
              entity: 'USER',
              entityId: input.userId,
              dataLevel: 'CONFIGURACION',
              previousData: { active: current.active },
              newData: { active: input.active },
              reason: input.reason,
              requestId: input.requestId,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      .catch((error: unknown) => this.mapTransactionConflict(error));
    return this.requiredCurrentUser(input.userId);
  }

  async changeAccess(
    input: CreateManagedUserInput & { userId: string; expectedUpdatedAt: Date },
  ): Promise<ManagedUser> {
    await this.prisma.client
      .$transaction(
        async (tx) => {
          const currentRole = await tx.userRole.findFirst({
            where: { userId: input.userId, active: true, endDate: null },
            include: { role: true },
          });
          const currentAssignment = await tx.userTerritorialAssignment.findFirst({
            where: { userId: input.userId, active: true, endDate: null },
          });
          if (!currentRole || !currentAssignment)
            throw new ManagedUserNotFoundError('El usuario no tiene un acceso vigente.');
          if (
            input.startDate < currentRole.startDate ||
            input.startDate < currentAssignment.startDate
          )
            throw new ManagedUserInvariantError(
              'La nueva vigencia no puede iniciar antes que la asignación actual.',
            );
          const cas = await tx.appUser.updateMany({
            where: { id: input.userId, updatedAt: input.expectedUpdatedAt },
            data: { updatedAt: new Date() },
          });
          if (cas.count !== 1)
            throw new ManagedUserConcurrencyError(
              'El usuario cambió mientras lo editaba. Recargue e intente nuevamente.',
            );
          const role = await tx.role.findUniqueOrThrow({ where: { code: input.roleCode } });
          await tx.userRole.update({
            where: { id: currentRole.id },
            data: { active: false, endDate: input.startDate },
          });
          await tx.userTerritorialAssignment.update({
            where: { id: currentAssignment.id },
            data: { active: false, endDate: input.startDate },
          });
          await tx.userRole.create({
            data: {
              userId: input.userId,
              roleId: role.id,
              startDate: input.startDate,
            },
          });
          await tx.userTerritorialAssignment.create({
            data: {
              userId: input.userId,
              scopeType: input.scopeType,
              regionId: input.regionId,
              municipalityId: input.municipalityId,
              facilityId: input.facilityId,
              startDate: input.startDate,
            },
          });
          await tx.auditEvent.create({
            data: {
              actorUserId: input.actorUserId,
              action: 'USER_ACCESS_CHANGED',
              entity: 'USER',
              entityId: input.userId,
              dataLevel: 'CONFIGURACION',
              previousData: {
                roleCode: currentRole.role.code,
                scopeType: currentAssignment.scopeType,
                regionId: currentAssignment.regionId,
                municipalityId: currentAssignment.municipalityId,
                facilityId: currentAssignment.facilityId,
              },
              newData: {
                roleCode: role.code,
                scopeType: input.scopeType,
                regionId: input.regionId,
                municipalityId: input.municipalityId,
                facilityId: input.facilityId,
              },
              reason: input.reason,
              requestId: input.requestId,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      .catch((error: unknown) => this.mapTransactionConflict(error));
    return this.requiredCurrentUser(input.userId);
  }

  private toDomain(row: ManagedUserRow): ManagedUser {
    const role = row.roles[0]!;
    const assignment = row.assignments[0]!;
    return {
      id: row.id,
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      active: row.active,
      hasExternalIdentity: row.externalIdentities.length > 0,
      role: { code: role.role.code as RoleCode, name: role.role.name, startDate: role.startDate },
      assignment: {
        scopeType: assignment.scopeType,
        regionId: assignment.regionId,
        municipalityId: assignment.municipalityId,
        facilityId: assignment.facilityId,
        label:
          assignment.region?.name ??
          assignment.municipality?.name ??
          assignment.facility?.name ??
          'Honduras',
        startDate: assignment.startDate,
      },
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private today(): Date {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return today;
  }

  private findCurrentUser(userId: string): Promise<ManagedUserRow | null> {
    const today = this.today();
    const current = {
      active: true,
      startDate: { lte: today },
      OR: [{ endDate: null }, { endDate: { gte: today } }],
    };
    return this.prisma.client.appUser.findUnique({
      where: { id: userId },
      include: {
        externalIdentities: { take: 1 },
        roles: { where: current, include: { role: true }, take: 1 },
        assignments: {
          where: current,
          include: {
            region: true,
            municipality: true,
            facility: { include: { municipality: true } },
          },
          take: 1,
        },
      },
    });
  }

  private async requiredCurrentUser(userId: string): Promise<ManagedUser> {
    const row = await this.findCurrentUser(userId);
    if (!row || !row.roles[0] || !row.assignments[0])
      throw new ManagedUserNotFoundError('El usuario no tiene un acceso vigente.');
    return this.toDomain(row);
  }

  private mapTransactionConflict(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')
      throw new ManagedUserConcurrencyError(
        'Otra operación modificó el acceso simultáneamente. Recargue e intente nuevamente.',
      );
    throw error;
  }
}
