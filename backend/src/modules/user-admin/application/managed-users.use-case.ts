import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { authConfig } from '../../../config/app.config';
import {
  RoleCode,
  type AuthorizationSubject,
  type TerritorialScopeType,
} from '../../authorization/domain/authorization.types';
import {
  InvalidManagedUserError,
  ManagedUserInvariantError,
  ManagedUserNotFoundError,
  ManagedUserRoleError,
  ManagedUserScopeError,
  type ManagedUser,
  type ManagedUserContext,
} from '../domain/managed-user';
import { ManagedUserRepository } from './ports/managed-user.repository';
import { IdentityInvitationGateway } from './ports/identity-invitation.gateway';

const HIERARCHY: Record<RoleCode, number> = {
  [RoleCode.SuperAdmin]: 100,
  [RoleCode.CentralAdmin]: 90,
  [RoleCode.RegionalSuperAdmin]: 80,
  [RoleCode.RegionalAdmin]: 70,
  [RoleCode.MunicipalCoordinator]: 60,
  [RoleCode.CoordinationDataEntry]: 50,
  [RoleCode.FacilityManager]: 40,
  [RoleCode.ReadOnlySupervisor]: 30,
};

@Injectable()
export class ManagedUsersUseCase {
  constructor(
    private readonly repository: ManagedUserRepository,
    @Inject(authConfig.KEY) private readonly authentication: ConfigType<typeof authConfig>,
    private readonly invitations: IdentityInvitationGateway,
  ) {}

  list(subject: AuthorizationSubject): Promise<ManagedUser[]> {
    return this.repository.list(
      subject.territory.national ? undefined : subject.territory.regionIds,
    );
  }

  async create(
    input: {
      fullName: string;
      email: string;
      phone?: string;
      roleCode: RoleCode;
      scopeType: TerritorialScopeType;
      regionId?: string;
      municipalityId?: string;
      facilityId?: string;
      startDate: string;
      reason: string;
      requestId: string;
    },
    subject: AuthorizationSubject,
  ): Promise<ManagedUser> {
    this.requireAssignableRole(input.roleCode, subject);
    this.requireCompatibleScope(input.roleCode, input.scopeType);
    const fullName = input.fullName.trim().replace(/\s+/g, ' ');
    const email = input.email.trim().toLowerCase();
    const reason = input.reason.trim().replace(/\s+/g, ' ');
    const startDate = new Date(`${input.startDate}T00:00:00.000Z`);
    if (fullName.length < 3 || fullName.length > 160)
      throw new InvalidManagedUserError('El nombre debe contener entre 3 y 160 caracteres.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255)
      throw new InvalidManagedUserError('El correo electrónico no es válido.');
    if (reason.length < 10 || reason.length > 500)
      throw new InvalidManagedUserError('El motivo debe contener entre 10 y 500 caracteres.');
    if (Number.isNaN(startDate.getTime()))
      throw new InvalidManagedUserError('La fecha de inicio no es válida.');
    if (!(await this.repository.roleExists(input.roleCode)))
      throw new InvalidManagedUserError('El rol solicitado no está activo.');

    const target = await this.repository.resolveTerritory({
      scopeType: input.scopeType,
      regionId: input.regionId ?? null,
      municipalityId: input.municipalityId ?? null,
      facilityId: input.facilityId ?? null,
    });
    if (!target)
      throw new InvalidManagedUserError('El alcance territorial no existe o no está activo.');
    if (
      !subject.territory.national &&
      (!target.regionId || !subject.territory.regionIds.includes(target.regionId))
    )
      throw new ManagedUserScopeError('No puede administrar usuarios fuera de su región.');
    if (input.scopeType === 'NACIONAL' && !subject.territory.national)
      throw new ManagedUserScopeError(
        'Sólo un administrador nacional puede asignar alcance nacional.',
      );

    return this.repository.create({
      fullName,
      email,
      phone: input.phone?.trim() || null,
      roleCode: input.roleCode,
      scopeType: input.scopeType,
      regionId: input.regionId ?? null,
      municipalityId: input.municipalityId ?? null,
      facilityId: input.facilityId ?? null,
      startDate,
      actorUserId: subject.userId,
      requestId: input.requestId,
      reason,
    });
  }

  async updateStatus(
    userId: string,
    input: { active: boolean; expectedUpdatedAt: string; reason: string; requestId: string },
    subject: AuthorizationSubject,
  ): Promise<ManagedUser> {
    const context = await this.requiredManageableUser(userId, subject);
    if (userId === subject.userId)
      throw new ManagedUserInvariantError('No puede suspender ni reactivar su propia cuenta.');
    if (input.active && !context.hasExternalIdentity)
      throw new ManagedUserInvariantError(
        'Debe vincular una identidad externa antes de activar el perfil.',
      );
    if (
      !input.active &&
      context.roleCode === RoleCode.SuperAdmin &&
      (await this.repository.countActiveSuperAdmins()) <= 1
    )
      throw new ManagedUserInvariantError('No se puede suspender al último SuperAdmin activo.');
    return this.repository.updateStatus({
      userId,
      active: input.active,
      expectedUpdatedAt: this.timestamp(input.expectedUpdatedAt),
      actorUserId: subject.userId,
      requestId: input.requestId,
      reason: this.reason(input.reason),
    });
  }

  async changeAccess(
    userId: string,
    input: {
      roleCode: RoleCode;
      scopeType: TerritorialScopeType;
      regionId?: string;
      municipalityId?: string;
      facilityId?: string;
      startDate: string;
      expectedUpdatedAt: string;
      reason: string;
      requestId: string;
    },
    subject: AuthorizationSubject,
  ): Promise<ManagedUser> {
    await this.requiredManageableUser(userId, subject);
    if (userId === subject.userId)
      throw new ManagedUserInvariantError('No puede modificar su propio rol o alcance.');
    this.requireAssignableRole(input.roleCode, subject);
    this.requireCompatibleScope(input.roleCode, input.scopeType);
    if (!(await this.repository.roleExists(input.roleCode)))
      throw new InvalidManagedUserError('El rol solicitado no está activo.');
    const target = await this.repository.resolveTerritory({
      scopeType: input.scopeType,
      regionId: input.regionId ?? null,
      municipalityId: input.municipalityId ?? null,
      facilityId: input.facilityId ?? null,
    });
    if (!target)
      throw new InvalidManagedUserError('El alcance territorial no existe o no está activo.');
    if (
      !subject.territory.national &&
      (!target.regionId || !subject.territory.regionIds.includes(target.regionId))
    )
      throw new ManagedUserScopeError('No puede asignar un alcance fuera de su región.');
    return this.repository.changeAccess({
      userId,
      fullName: '',
      email: '',
      phone: null,
      roleCode: input.roleCode,
      scopeType: input.scopeType,
      regionId: input.regionId ?? null,
      municipalityId: input.municipalityId ?? null,
      facilityId: input.facilityId ?? null,
      startDate: this.date(input.startDate),
      actorUserId: subject.userId,
      requestId: input.requestId,
      reason: this.reason(input.reason),
      expectedUpdatedAt: this.timestamp(input.expectedUpdatedAt),
    });
  }

  async linkExternalIdentity(
    userId: string,
    input: {
      externalSubject: string;
      activate: boolean;
      expectedUpdatedAt: string;
      reason: string;
      requestId: string;
    },
    subject: AuthorizationSubject,
  ): Promise<ManagedUser> {
    await this.requiredManageableUser(userId, subject);
    if (userId === subject.userId)
      throw new ManagedUserInvariantError('No puede modificar su propia identidad externa.');
    const issuer = this.authentication.issuer?.trim();
    if (!issuer)
      throw new ManagedUserInvariantError(
        'El proveedor de identidad externo no está configurado en el servidor.',
      );
    const externalSubject = input.externalSubject.trim();
    if (
      !externalSubject ||
      externalSubject.length > 255 ||
      /\s/.test(externalSubject) ||
      [...externalSubject].some((character) => {
        const code = character.codePointAt(0) ?? 0;
        return code < 32 || code === 127;
      })
    )
      throw new InvalidManagedUserError('El identificador externo no es válido.');
    return this.repository.linkExternalIdentity({
      userId,
      issuer,
      subject: externalSubject,
      activate: input.activate,
      expectedUpdatedAt: this.timestamp(input.expectedUpdatedAt),
      actorUserId: subject.userId,
      requestId: input.requestId,
      reason: this.reason(input.reason),
    });
  }

  async invite(
    userId: string,
    input: { activate: boolean; expectedUpdatedAt: string; reason: string; requestId: string },
    subject: AuthorizationSubject,
  ): Promise<ManagedUser> {
    const context = await this.requiredManageableUser(userId, subject);
    if (userId === subject.userId)
      throw new ManagedUserInvariantError('No puede modificar su propia identidad externa.');
    if (context.hasExternalIdentity)
      throw new ManagedUserInvariantError('El perfil ya tiene una identidad externa vinculada.');
    const issuer = this.authentication.issuer?.trim();
    if (!issuer)
      throw new ManagedUserInvariantError(
        'El proveedor de identidad externo no está configurado en el servidor.',
      );
    const invited = await this.invitations.invite(context.email);
    return this.repository.linkExternalIdentity({
      userId,
      issuer,
      subject: invited.subject,
      activate: input.activate,
      expectedUpdatedAt: this.timestamp(input.expectedUpdatedAt),
      actorUserId: subject.userId,
      requestId: input.requestId,
      reason: this.reason(input.reason),
    });
  }

  private requireAssignableRole(role: RoleCode, subject: AuthorizationSubject): void {
    const actorLevel = Math.max(0, ...subject.roles.map((code) => HIERARCHY[code]));
    if (HIERARCHY[role] >= actorLevel)
      throw new ManagedUserRoleError('No puede asignar un rol igual o superior al propio.');
    if (!subject.territory.national && HIERARCHY[role] >= HIERARCHY[RoleCode.RegionalSuperAdmin])
      throw new ManagedUserRoleError(
        'Un administrador regional no puede asignar roles nacionales ni SuperAdmin Regional.',
      );
  }

  private requireCompatibleScope(role: RoleCode, scope: TerritorialScopeType): void {
    const allowed: Record<RoleCode, readonly TerritorialScopeType[]> = {
      [RoleCode.SuperAdmin]: ['NACIONAL'],
      [RoleCode.CentralAdmin]: ['NACIONAL'],
      [RoleCode.RegionalSuperAdmin]: ['REGION'],
      [RoleCode.RegionalAdmin]: ['REGION'],
      [RoleCode.MunicipalCoordinator]: ['MUNICIPIO'],
      [RoleCode.CoordinationDataEntry]: ['ESTABLECIMIENTO'],
      [RoleCode.FacilityManager]: ['ESTABLECIMIENTO'],
      [RoleCode.ReadOnlySupervisor]: ['REGION', 'MUNICIPIO', 'ESTABLECIMIENTO'],
    };
    if (!allowed[role].includes(scope))
      throw new ManagedUserRoleError('El tipo de alcance no es compatible con el rol solicitado.');
  }

  private async requiredManageableUser(
    userId: string,
    subject: AuthorizationSubject,
  ): Promise<ManagedUserContext> {
    const context = await this.repository.findContext(userId);
    if (!context)
      throw new ManagedUserNotFoundError('El usuario no existe o no tiene acceso vigente.');
    const actorLevel = Math.max(0, ...subject.roles.map((code) => HIERARCHY[code]));
    if (HIERARCHY[context.roleCode] >= actorLevel && userId !== subject.userId)
      throw new ManagedUserRoleError(
        'No puede administrar un usuario de jerarquía igual o superior.',
      );
    if (
      !subject.territory.national &&
      (!context.regionId || !subject.territory.regionIds.includes(context.regionId))
    )
      throw new ManagedUserScopeError('El usuario está fuera de su alcance administrativo.');
    return context;
  }

  private reason(value: string): string {
    const reason = value.trim().replace(/\s+/g, ' ');
    if (reason.length < 10 || reason.length > 500)
      throw new InvalidManagedUserError('El motivo debe contener entre 10 y 500 caracteres.');
    return reason;
  }

  private timestamp(value: string): Date {
    const timestamp = new Date(value);
    if (Number.isNaN(timestamp.getTime()))
      throw new InvalidManagedUserError('La versión del usuario no es válida.');
    return timestamp;
  }

  private date(value: string): Date {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()))
      throw new InvalidManagedUserError('La fecha de inicio no es válida.');
    return date;
  }
}
