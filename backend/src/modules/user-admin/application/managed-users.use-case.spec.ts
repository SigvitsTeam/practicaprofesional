import {
  RoleCode,
  type AuthorizationSubject,
  type TerritorialScopeType,
} from '../../authorization/domain/authorization.types';
import {
  InvalidManagedUserError,
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
  const invite = jest.fn().mockResolvedValue({ subject: 'provider-user-123' });
  const invitations: IdentityInvitationGateway = { invite };

  beforeEach(() => {
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
