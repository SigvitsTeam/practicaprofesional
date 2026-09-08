import {
  RoleCode,
  type AuthorizationSubject,
  type TerritorialScopeType,
} from '../../authorization/domain/authorization.types';
import {
  IdentityInvitationError,
  InvalidManagedUserError,
  ManagedUserConcurrencyError,
  ManagedUserInvariantError,
  ManagedUserRoleError,
  ManagedUserScopeError,
  type CreateManagedUserInput,
  type LinkExternalIdentityInput,
  type ManagedUser,
} from '../domain/managed-user';
import { ManagedUsersUseCase } from './managed-users.use-case';
import { ManagedUserRepository } from './ports/managed-user.repository';
import { IdentityInvitationGateway } from './ports/identity-invitation.gateway';

class Repository extends ManagedUserRepository {
  created?: CreateManagedUserInput;
  resent?: { userId: string; actorUserId: string; requestId: string; reason: string };
  lastResendAt?: Date;
  context = {
    id: 'user-2',
    email: 'maria@example.org',
    active: true,
    hasExternalIdentity: true,
    roleCode: RoleCode.MunicipalCoordinator,
    regionId: 'region-cortes',
    updatedAt: new Date('2026-08-17T12:00:00.000Z'),
  };
  list(): Promise<ManagedUser[]> {
    return Promise.resolve([]);
  }
  roleExists(): Promise<boolean> {
    return Promise.resolve(true);
  }
  resolveTerritory(input: {
    scopeType: TerritorialScopeType;
    regionId: string | null;
    municipalityId: string | null;
    facilityId: string | null;
  }): Promise<{ regionId: string | null; label: string } | null> {
    if (input.scopeType === 'NACIONAL')
      return Promise.resolve({ regionId: null, label: 'Honduras' });
    return Promise.resolve({
      regionId:
        input.regionId ??
        (input.municipalityId === 'municipality-cortes' ? 'region-cortes' : 'region-other'),
      label: 'Territorio',
    });
  }
  create(input: CreateManagedUserInput): Promise<ManagedUser> {
    this.created = input;
    return Promise.resolve({
      id: 'user-2',
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      active: false,
      hasExternalIdentity: false,
      role: { code: input.roleCode, name: input.roleCode, startDate: input.startDate },
      assignment: {
        scopeType: input.scopeType,
        regionId: input.regionId,
        municipalityId: input.municipalityId,
        facilityId: input.facilityId,
        label: 'Territorio',
        startDate: input.startDate,
      },
      createdAt: new Date(),
      updatedAt: this.context.updatedAt,
    });
  }
  findContext(userId: string): Promise<typeof this.context> {
    return Promise.resolve({ ...this.context, id: userId });
  }
  findExternalIdentity(): Promise<{ subject: string } | null> {
    return Promise.resolve(
      this.context.hasExternalIdentity ? { subject: 'provider-user-123' } : null,
    );
  }
  reserveInvitationResend(input: {
    userId: string;
    actorUserId: string;
    requestId: string;
    reason: string;
    expectedUpdatedAt: Date;
    notBefore: Date;
  }): Promise<Date> {
    if (input.expectedUpdatedAt.getTime() !== this.context.updatedAt.getTime())
      return Promise.reject(new ManagedUserConcurrencyError('versión obsoleta'));
    if (this.lastResendAt && this.lastResendAt >= input.notBefore)
      return Promise.reject(new ManagedUserInvariantError('reenvío reciente'));
    const profileUpdatedAt = new Date(this.context.updatedAt.getTime() + 1);
    this.context = { ...this.context, updatedAt: profileUpdatedAt };
    this.lastResendAt = new Date();
    this.resent = {
      userId: input.userId,
      actorUserId: input.actorUserId,
      requestId: input.requestId,
      reason: input.reason,
    };
    return Promise.resolve(profileUpdatedAt);
  }
  countActiveSuperAdmins(): Promise<number> {
    return Promise.resolve(1);
  }
  updateStatus(input: { userId: string; active: boolean }): Promise<ManagedUser> {
    return this.create({
      ...basePersisted,
      actorUserId: 'admin-1',
      requestId: 'request-1',
      reason: 'Motivo administrativo válido',
    }).then((user) => ({ ...user, id: input.userId, active: input.active }));
  }
  changeAccess(input: CreateManagedUserInput & { userId: string }): Promise<ManagedUser> {
    return this.create(input).then((user) => ({ ...user, id: input.userId }));
  }
  linkExternalIdentity(input: LinkExternalIdentityInput): Promise<ManagedUser> {
    return this.create({
      ...basePersisted,
      actorUserId: input.actorUserId,
      requestId: input.requestId,
      reason: input.reason,
    }).then((user) => ({
      ...user,
      id: input.userId,
      active: input.activate,
      hasExternalIdentity: true,
    }));
  }
}

const basePersisted: CreateManagedUserInput = {
  fullName: 'María López',
  email: 'maria@example.org',
  phone: null,
  roleCode: RoleCode.MunicipalCoordinator,
  scopeType: 'MUNICIPIO',
  regionId: null,
  municipalityId: 'municipality-cortes',
  facilityId: null,
  startDate: new Date('2026-08-17T00:00:00.000Z'),
  actorUserId: 'admin-1',
  requestId: 'request-1',
  reason: 'Asignación aprobada para el piloto',
};

describe('ManagedUsersUseCase', () => {
  const national: AuthorizationSubject = {
    userId: 'superadmin-1',
    roles: [RoleCode.SuperAdmin],
    permissions: [],
    territory: { national: true, regionIds: [], municipalityIds: [], facilityIds: [] },
  };
  const roleScopes: { role: RoleCode; scopes: TerritorialScopeType[] }[] = [
    { role: RoleCode.CentralAdmin, scopes: ['NACIONAL'] },
    { role: RoleCode.RegionalSuperAdmin, scopes: ['REGION'] },
    { role: RoleCode.RegionalAdmin, scopes: ['REGION'] },
    { role: RoleCode.MunicipalCoordinator, scopes: ['MUNICIPIO'] },
    { role: RoleCode.CoordinationDataEntry, scopes: ['MUNICIPIO', 'ESTABLECIMIENTO'] },
    { role: RoleCode.FacilityManager, scopes: ['ESTABLECIMIENTO'] },
    { role: RoleCode.ReadOnlySupervisor, scopes: ['REGION', 'MUNICIPIO', 'ESTABLECIMIENTO'] },
  ];
  const scopes: TerritorialScopeType[] = ['NACIONAL', 'REGION', 'MUNICIPIO', 'ESTABLECIMIENTO'];
  const compatibilityCases = roleScopes.flatMap(({ role, scopes: allowed }) =>
    scopes.map((scope) => ({ role, scope, allowed: allowed.includes(scope) })),
  );
  const regional: AuthorizationSubject = {
    userId: 'admin-1',
    roles: [RoleCode.RegionalSuperAdmin],
    permissions: [],
    territory: {
      national: false,
      regionIds: ['region-cortes'],
      municipalityIds: [],
      facilityIds: [],
    },
  };
  const base = {
    fullName: ' María   López ',
    email: ' MARIA@EXAMPLE.ORG ',
    roleCode: RoleCode.MunicipalCoordinator,
    scopeType: 'MUNICIPIO' as const,
    municipalityId: 'municipality-cortes',
    startDate: '2026-08-17',
    reason: 'Asignación aprobada para el piloto',
    requestId: 'request-1',
  };
  let repository: Repository;
  let useCase: ManagedUsersUseCase;
  const pendingInvitation = {
    status: 'PENDING' as const,
    sentAt: new Date('2026-09-03T12:00:00.000Z'),
    emailConfirmedAt: null,
    lastAccessAt: null,
  };
  const invite = jest.fn().mockResolvedValue({ subject: 'provider-user-123' });
  const getStatus = jest.fn().mockResolvedValue(pendingInvitation);
  const invitations: IdentityInvitationGateway = { invite, getStatus };

  beforeEach(() => {
    invite.mockReset().mockResolvedValue({ subject: 'provider-user-123' });
    getStatus.mockReset().mockResolvedValue(pendingInvitation);
    repository = new Repository();
    useCase = new ManagedUsersUseCase(
      repository,
      {
        issuer: 'https://identity.example.org',
        audience: 'sigvits-api',
        jwksUrl: 'https://identity.example.org/.well-known/jwks.json',
        clockToleranceSeconds: 5,
        jwksTimeoutMs: 5_000,
        adminSecret: 'server-only-secret',
        invitationRedirectUrl: 'https://sigvits.example.org',
        adminTimeoutMs: 5_000,
      },
      invitations,
    );
  });

  it('crea pendiente de identidad y normaliza el perfil dentro del alcance', async () => {
    const result = await useCase.create(base, regional);
    expect(result).toMatchObject({
      fullName: 'María López',
      email: 'maria@example.org',
      active: false,
      hasExternalIdentity: false,
    });
    expect(repository.created?.actorUserId).toBe('admin-1');
  });

  describe.each(['create', 'changeAccess'] as const)('%s scope compatibility', (operation) => {
    it.each(compatibilityCases)(
      '$role with $scope: allowed=$allowed',
      async ({ role, scope, allowed }) => {
        const input = {
          ...base,
          roleCode: role,
          scopeType: scope,
          regionId: scope === 'REGION' ? 'region-cortes' : undefined,
          municipalityId: scope === 'MUNICIPIO' ? 'municipality-cortes' : undefined,
          facilityId: scope === 'ESTABLECIMIENTO' ? 'facility-cortes' : undefined,
          expectedUpdatedAt: repository.context.updatedAt.toISOString(),
        };
        const result =
          operation === 'create'
            ? useCase.create(input, national)
            : useCase.changeAccess('user-2', input, national);
        if (allowed) {
          await expect(result).resolves.toMatchObject({
            role: { code: role },
            assignment: { scopeType: scope },
          });
        } else {
          await expect(result).rejects.toBeInstanceOf(ManagedUserRoleError);
          expect(repository.created).toBeUndefined();
        }
      },
    );
  });

  it('invita por correo y vincula el subject devuelto por el proveedor', async () => {
    repository.context = { ...repository.context, active: false, hasExternalIdentity: false };
    const result = await useCase.invite(
      'user-2',
      {
        activate: true,
        expectedUpdatedAt: repository.context.updatedAt.toISOString(),
        reason: 'Invitación institucional aprobada',
        requestId: 'request-invite',
      },
      regional,
    );
    expect(invite).toHaveBeenCalledWith('maria@example.org');
    expect(result).toMatchObject({ active: true, hasExternalIdentity: true });
  });

  it('consulta en Supabase sólo el estado mínimo de la identidad administrable', async () => {
    await expect(useCase.getInvitationStatus('user-2', regional)).resolves.toEqual({
      ...pendingInvitation,
      profileUpdatedAt: repository.context.updatedAt,
    });
    expect(getStatus).toHaveBeenCalledWith('provider-user-123');
  });

  it('deniega la consulta de invitación fuera del alcance antes de contactar al proveedor', async () => {
    repository.context = { ...repository.context, regionId: 'region-other' };
    await expect(useCase.getInvitationStatus('user-2', regional)).rejects.toBeInstanceOf(
      ManagedUserScopeError,
    );
    expect(getStatus).not.toHaveBeenCalled();
  });

  it('reenvía una invitación pendiente sólo cuando Supabase conserva el mismo subject', async () => {
    await expect(
      useCase.resendInvitation(
        'user-2',
        {
          expectedUpdatedAt: repository.context.updatedAt.toISOString(),
          reason: 'Reenvío solicitado por enlace vencido',
          requestId: 'request-resend',
        },
        regional,
      ),
    ).resolves.toEqual({
      ...pendingInvitation,
      profileUpdatedAt: new Date('2026-08-17T12:00:00.001Z'),
    });
    expect(invite).toHaveBeenCalledWith('maria@example.org');
    expect(getStatus).toHaveBeenCalledTimes(1);
    expect(repository.resent).toEqual({
      userId: 'user-2',
      actorUserId: 'admin-1',
      requestId: 'request-resend',
      reason: 'Reenvío solicitado por enlace vencido',
    });
  });

  it('no reenvía una invitación que Supabase ya reporta aceptada', async () => {
    getStatus.mockResolvedValue({
      ...pendingInvitation,
      status: 'EMAIL_CONFIRMED',
      emailConfirmedAt: new Date('2026-09-03T12:10:00.000Z'),
    });
    await expect(
      useCase.resendInvitation(
        'user-2',
        {
          expectedUpdatedAt: repository.context.updatedAt.toISOString(),
          reason: 'Reenvío solicitado por enlace vencido',
          requestId: 'request-resend',
        },
        regional,
      ),
    ).rejects.toBeInstanceOf(ManagedUserInvariantError);
    expect(invite).not.toHaveBeenCalled();
  });

  it('rechaza un subject distinto durante el reenvío sin sobrescribir la vinculación', async () => {
    invite.mockResolvedValue({ subject: 'unexpected-provider-user' });
    await expect(
      useCase.resendInvitation(
        'user-2',
        {
          expectedUpdatedAt: repository.context.updatedAt.toISOString(),
          reason: 'Reenvío solicitado por enlace vencido',
          requestId: 'request-resend',
        },
        regional,
      ),
    ).rejects.toBeInstanceOf(IdentityInvitationError);
    expect(repository.resent?.userId).toBe('user-2');
  });

  it('reserva una nueva versión y rechaza otro reenvío con la versión anterior', async () => {
    const expectedUpdatedAt = repository.context.updatedAt.toISOString();
    await useCase.resendInvitation(
      'user-2',
      { reason: 'Primer reenvío controlado para QA', requestId: 'first', expectedUpdatedAt },
      regional,
    );

    await expect(
      useCase.resendInvitation(
        'user-2',
        { reason: 'Segundo reenvío simultáneo para QA', requestId: 'second', expectedUpdatedAt },
        regional,
      ),
    ).rejects.toBeInstanceOf(ManagedUserConcurrencyError);
    expect(invite).toHaveBeenCalledTimes(1);
  });

  it('aplica una pausa auditada aunque el cliente ya conozca la versión reservada', async () => {
    repository.lastResendAt = new Date();
    await expect(
      useCase.resendInvitation(
        'user-2',
        {
          reason: 'Reenvío repetido dentro de la pausa',
          requestId: 'cooldown',
          expectedUpdatedAt: repository.context.updatedAt.toISOString(),
        },
        regional,
      ),
    ).rejects.toBeInstanceOf(ManagedUserInvariantError);
    expect(invite).not.toHaveBeenCalled();
  });

  it.each([
    { reason: 'breve', expectedUpdatedAt: '2026-08-17T00:00:00Z' },
    { reason: 'Invitación aprobada', expectedUpdatedAt: 'invalid-date' },
    { reason: 'Invitación aprobada', expectedUpdatedAt: '2001-01-01T00:00:00Z' },
  ])(
    'validates invitation input and version before contacting the provider ($expectedUpdatedAt)',
    async (invalid) => {
      repository.context = { ...repository.context, active: false, hasExternalIdentity: false };
      await expect(
        useCase.invite('user-2', { activate: true, requestId: 'qa', ...invalid }, regional),
      ).rejects.toThrow();
      expect(invite).not.toHaveBeenCalled();
    },
  );

  it('impide asignar un rol igual o superior al del actor', async () => {
    await expect(
      useCase.create({ ...base, roleCode: RoleCode.RegionalSuperAdmin }, regional),
    ).rejects.toBeInstanceOf(ManagedUserRoleError);
  });

  it('impide combinar un rol con un alcance excesivo', async () => {
    await expect(
      useCase.create(
        {
          ...base,
          roleCode: RoleCode.FacilityManager,
          scopeType: 'REGION',
          regionId: 'region-cortes',
          municipalityId: undefined,
        },
        regional,
      ),
    ).rejects.toBeInstanceOf(ManagedUserRoleError);
  });

  it('impide crear usuarios fuera de la región administrada', async () => {
    await expect(
      useCase.create({ ...base, municipalityId: 'municipality-other' }, regional),
    ).rejects.toBeInstanceOf(ManagedUserScopeError);
  });

  it('suspende con la versión esperada cuando el usuario es administrable', async () => {
    const result = await useCase.updateStatus(
      'user-2',
      {
        active: false,
        expectedUpdatedAt: repository.context.updatedAt.toISOString(),
        reason: 'Suspensión autorizada por cambio laboral',
        requestId: 'request-2',
      },
      regional,
    );
    expect(result.active).toBe(false);
  });

  it('impide modificar el acceso propio', async () => {
    repository.context.id = 'admin-1';
    await expect(
      useCase.updateStatus(
        'admin-1',
        {
          active: false,
          expectedUpdatedAt: repository.context.updatedAt.toISOString(),
          reason: 'Intento de suspensión del usuario actual',
          requestId: 'request-3',
        },
        regional,
      ),
    ).rejects.toBeInstanceOf(ManagedUserInvariantError);
  });

  it('vincula y activa una identidad externa usando el issuer configurado', async () => {
    repository.context.hasExternalIdentity = false;
    repository.context.active = false;
    const result = await useCase.linkExternalIdentity(
      'user-2',
      {
        externalSubject: 'provider-user-123',
        activate: true,
        expectedUpdatedAt: repository.context.updatedAt.toISOString(),
        reason: 'Identidad verificada en el directorio institucional',
        requestId: 'request-link-1',
      },
      regional,
    );
    expect(result).toMatchObject({ active: true, hasExternalIdentity: true });
  });

  it('rechaza identificadores externos con espacios o caracteres de control', async () => {
    await expect(
      useCase.linkExternalIdentity(
        'user-2',
        {
          externalSubject: 'subject con espacios',
          activate: true,
          expectedUpdatedAt: repository.context.updatedAt.toISOString(),
          reason: 'Identidad verificada en el directorio institucional',
          requestId: 'request-link-2',
        },
        regional,
      ),
    ).rejects.toBeInstanceOf(InvalidManagedUserError);
  });
});
