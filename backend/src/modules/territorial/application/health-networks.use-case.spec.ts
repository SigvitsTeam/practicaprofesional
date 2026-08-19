import {
  RoleCode,
  type AuthorizationSubject,
} from '../../authorization/domain/authorization.types';
import { HealthNetworksUseCase } from './health-networks.use-case';
import { HealthNetworkRepository } from './ports/health-network.repository';
import { OperationalStatus } from '../domain/region';
import { TerritorialScopeDeniedError } from '../domain/territorial-catalog';
import type { CreateHealthNetworkInput, HealthNetworkSummary } from '../domain/health-network';

class Repository extends HealthNetworkRepository {
  created?: CreateHealthNetworkInput;
  list(): Promise<HealthNetworkSummary[]> {
    return Promise.resolve([]);
  }
  resolveRegion(regionId: string): Promise<{ id: string; active: boolean } | null> {
    return Promise.resolve({ id: regionId, active: true });
  }
  validateMunicipalities(regionId: string, municipalityIds: readonly string[]): Promise<boolean> {
    return Promise.resolve(
      regionId === 'region-cortes' && !municipalityIds.includes('municipality-other'),
    );
  }
  findRegionId(): Promise<string | null> {
    return Promise.resolve('region-cortes');
  }
  findStatusContext(): Promise<{
    id: string;
    regionId: string;
    operationalStatus: OperationalStatus;
    active: boolean;
    updatedAt: Date;
  }> {
    return Promise.resolve({
      id: 'network-1',
      regionId: 'region-cortes',
      operationalStatus: OperationalStatus.Active,
      active: true,
      updatedAt: new Date('2026-08-19T12:00:00.000Z'),
    });
  }
  create(input: CreateHealthNetworkInput): Promise<HealthNetworkSummary> {
    this.created = input;
    return Promise.resolve(this.network(input));
  }
  replaceMunicipalities(input: {
    networkId: string;
    municipalityIds: string[];
    effectiveDate: Date;
    expectedUpdatedAt: Date;
    audit: CreateHealthNetworkInput['audit'];
  }): Promise<HealthNetworkSummary> {
    return Promise.resolve({
      ...this.network({
        regionId: 'region-cortes',
        code: 'RED-01',
        name: 'Red Cortés',
        description: null,
        operationalStatus: OperationalStatus.InPilot,
        startDate: input.effectiveDate,
        municipalityIds: input.municipalityIds,
        audit: input.audit,
      }),
      id: input.networkId,
    });
  }
  updateStatus(input: {
    networkId: string;
    status: OperationalStatus;
    expectedUpdatedAt: Date;
    audit: CreateHealthNetworkInput['audit'];
  }): Promise<HealthNetworkSummary> {
    return Promise.resolve({
      ...this.network({
        regionId: 'region-cortes',
        code: 'RED-01',
        name: 'Red Cortés',
        description: null,
        operationalStatus: input.status,
        startDate: new Date('2026-08-19T00:00:00.000Z'),
        municipalityIds: [],
        audit: input.audit,
      }),
      id: input.networkId,
      active: ![OperationalStatus.Inactive, OperationalStatus.Suspended].includes(input.status),
    });
  }
  private network(input: CreateHealthNetworkInput): HealthNetworkSummary {
    return {
      id: 'network-1',
      regionId: input.regionId,
      regionName: 'Cortés',
      code: input.code,
      name: input.name,
      description: input.description,
      operationalStatus: input.operationalStatus,
      startDate: input.startDate,
      active: true,
      municipalities: input.municipalityIds.map((id) => ({
        id,
        code: id,
        name: id,
        startDate: input.startDate,
      })),
      updatedAt: new Date('2026-08-19T12:00:00.000Z'),
    };
  }
}

describe('HealthNetworksUseCase', () => {
  const subject: AuthorizationSubject = {
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
  const audit = {
    actorUserId: 'admin-1',
    requestId: 'request-1',
    reason: 'Configuración validada institucionalmente',
  };
  let repository: Repository;
  let useCase: HealthNetworksUseCase;
  beforeEach(() => {
    repository = new Repository();
    useCase = new HealthNetworksUseCase(repository);
  });

  it('normaliza y crea una red con municipios de la región', async () => {
    const result = await useCase.create(
      {
        regionId: 'region-cortes',
        code: ' red-01 ',
        name: ' Red   Puerto Cortés ',
        operationalStatus: OperationalStatus.InPilot,
        startDate: '2026-08-19',
        municipalityIds: ['municipality-1'],
      },
      subject,
      audit,
    );
    expect(result).toMatchObject({
      code: 'RED-01',
      name: 'Red Puerto Cortés',
      regionId: 'region-cortes',
    });
    expect(repository.created?.municipalityIds).toEqual(['municipality-1']);
  });

  it('rechaza crear redes fuera del alcance regional', async () => {
    await expect(
      useCase.create(
        {
          regionId: 'region-other',
          code: 'RED-02',
          name: 'Otra red',
          operationalStatus: OperationalStatus.Created,
          startDate: '2026-08-19',
          municipalityIds: [],
        },
        subject,
        audit,
      ),
    ).rejects.toBeInstanceOf(TerritorialScopeDeniedError);
  });

  it('rechaza municipios que no pertenecen a la región', async () => {
    await expect(
      useCase.create(
        {
          regionId: 'region-cortes',
          code: 'RED-03',
          name: 'Red inválida',
          operationalStatus: OperationalStatus.Created,
          startDate: '2026-08-19',
          municipalityIds: ['municipality-other'],
        },
        subject,
        audit,
      ),
    ).rejects.toThrow('Todos los municipios');
  });

  it('suspende una red activa conservando su identidad y versión', async () => {
    const result = await useCase.updateStatus(
      'network-1',
      {
        status: OperationalStatus.Suspended,
        expectedUpdatedAt: '2026-08-19T12:00:00.000Z',
      },
      subject,
      audit,
    );
    expect(result).toMatchObject({
      id: 'network-1',
      operationalStatus: OperationalStatus.Suspended,
      active: false,
    });
  });

  it('rechaza una transición de red activa directamente a creada', async () => {
    await expect(
      useCase.updateStatus(
        'network-1',
        {
          status: OperationalStatus.Created,
          expectedUpdatedAt: '2026-08-19T12:00:00.000Z',
        },
        subject,
        audit,
      ),
    ).rejects.toThrow('No se permite cambiar');
  });
});
