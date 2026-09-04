import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { IdentityRepository } from '../src/modules/authorization/application/identity.repository';
import {
  TokenVerifier,
  type VerifiedIdentity,
} from '../src/modules/authorization/application/token-verifier';
import { AuthorizationPolicy } from '../src/modules/authorization/domain/authorization.policy';
import {
  RoleCode,
  type AuthorizationSubject,
} from '../src/modules/authorization/domain/authorization.types';
import { AuthenticationGuard } from '../src/modules/authorization/http/authentication.guard';
import { AuthorizationGuard } from '../src/modules/authorization/http/authorization.guard';
import { HealthNetworksUseCase } from '../src/modules/territorial/application/health-networks.use-case';
import { HealthNetworkRepository } from '../src/modules/territorial/application/ports/health-network.repository';
import { HealthNetworksController } from '../src/modules/territorial/http/health-networks.controller';

describe('Municipal network HTTP contract (synthetic identity)', () => {
  let app: INestApplication;
  let subject: AuthorizationSubject;
  const list = jest.fn().mockResolvedValue([]);
  const create = jest.fn();
  const replaceMunicipalities = jest.fn();
  const updateStatus = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthNetworksController],
      providers: [
        HealthNetworksUseCase,
        AuthenticationGuard,
        AuthorizationGuard,
        AuthorizationPolicy,
        {
          provide: TokenVerifier,
          useValue: {
            verify: (): Promise<VerifiedIdentity> =>
              Promise.resolve({ issuer: 'qa', subject: 'qa' }),
          },
        },
        {
          provide: IdentityRepository,
          useValue: {
            findSubject: (): Promise<AuthorizationSubject> => Promise.resolve(subject),
          },
        },
        {
          provide: HealthNetworkRepository,
          useValue: { list, create, replaceMunicipalities, updateStatus },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalGuards(moduleRef.get(AuthenticationGuard), moduleRef.get(AuthorizationGuard));
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });
  afterAll(async () => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    subject = {
      userId: 'qa',
      roles: [RoleCode.MunicipalCoordinator],
      permissions: ['territorial:networks:read'],
      territory: {
        national: false,
        regionIds: ['region-parent'],
        municipalityIds: ['municipality-own'],
        facilityIds: [],
      },
    };
  });

  it('accepts municipal read and passes only explicit grants and the requested date', async () => {
    await request(app.getHttpServer())
      .get('/territories/networks?asOf=2026-08-31')
      .auth('qa', { type: 'bearer' })
      .expect(200);
    expect(list).toHaveBeenCalledWith({
      national: false,
      regionGrantIds: [],
      municipalityIds: ['municipality-own'],
      asOf: new Date('2026-08-31T00:00:00Z'),
    });
  });
  it.each(['2026-02-30', 'not-a-date', '2026-08-31T12:00:00Z'])(
    'rejects invalid date %s with 400',
    async (asOf) => {
      await request(app.getHttpServer())
        .get('/territories/networks')
        .query({ asOf })
        .auth('qa', { type: 'bearer' })
        .expect(400);
      expect(list).not.toHaveBeenCalled();
    },
  );
  it('rejects caller-supplied scope overrides', async () => {
    await request(app.getHttpServer())
      .get('/territories/networks?regionId=other')
      .auth('qa', { type: 'bearer' })
      .expect(400);
    expect(list).not.toHaveBeenCalled();
  });
  it('rejects reads without the permission', async () => {
    subject.permissions = [];
    await request(app.getHttpServer())
      .get('/territories/networks')
      .auth('qa', { type: 'bearer' })
      .expect(403);
    expect(list).not.toHaveBeenCalled();
  });
  it('denies municipal create, membership changes and status updates before persistence', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    await request(app.getHttpServer())
      .post('/territories/networks')
      .auth('qa', { type: 'bearer' })
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .put(`/territories/networks/${id}/municipalities`)
      .auth('qa', { type: 'bearer' })
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/territories/networks/${id}/status`)
      .auth('qa', { type: 'bearer' })
      .send({})
      .expect(403);
    expect(create).not.toHaveBeenCalled();
    expect(replaceMunicipalities).not.toHaveBeenCalled();
    expect(updateStatus).not.toHaveBeenCalled();
  });
});
