import {
  RoleCode,
  type AuthorizationSubject,
} from '../../authorization/domain/authorization.types';
import { OperationalStatus } from '../domain/region';
import {
  TerritorialScopeDeniedError,
  type CreateFacilityInput,
  type CreateMunicipalityInput,
  type FacilitySummary,
  type MunicipalitySummary,
  type TerritorialEntityType,
  type TerritorialStatusContext,
} from '../domain/territorial-catalog';
import { TerritorialCatalogRepository } from './ports/territorial-catalog.repository';
import { TerritorialCatalogUseCase } from './territorial-catalog.use-case';

class Repository extends TerritorialCatalogRepository {
  municipalities: MunicipalitySummary[] = [];
  facilities: FacilitySummary[] = [];
  regions = [{ id: '11111111-1111-4111-8111-111111111111', active: true }];
  listMunicipalities(regionIds?: readonly string[]): Promise<MunicipalitySummary[]> {
    return Promise.resolve(
      this.municipalities.filter((row) => !regionIds || regionIds.includes(row.regionId)),
    );
  }
  listFacilities(municipalityIds?: readonly string[]): Promise<FacilitySummary[]> {
    return Promise.resolve(
      this.facilities.filter(
        (row) => !municipalityIds || municipalityIds.includes(row.municipalityId),
      ),
    );
  }
  findRegion(id: string): Promise<{ id: string; active: boolean } | null> {
    return Promise.resolve(this.regions.find((row) => row.id === id) ?? null);
  }
  findMunicipality(id: string): Promise<{ id: string; regionId: string; active: boolean } | null> {
    const row = this.municipalities.find((item) => item.id === id);
    return Promise.resolve(row ? { id: row.id, regionId: row.regionId, active: row.active } : null);
  }
  createMunicipality(input: CreateMunicipalityInput): Promise<MunicipalitySummary> {
    const row: MunicipalitySummary = {
      id: 'municipality-1',
      regionId: input.regionId,
      regionName: 'Cortés',
      officialCode: input.officialCode,
      name: input.name,
      operationalStatus: OperationalStatus.Created,
      mapValidated: false,
      active: true,
      facilityCount: 0,
      updatedAt: new Date('2026-08-19T12:00:00.000Z'),
    };
    this.municipalities.push(row);
    return Promise.resolve(row);
  }
  createFacility(input: CreateFacilityInput): Promise<FacilitySummary> {
    const row: FacilitySummary = {
      id: 'facility-1',
      municipalityId: input.municipalityId,
      municipalityName: 'Puerto Cortés',
      code: input.code,
      name: input.name,
      type: input.type,
      address: input.address,
      operationalStatus: OperationalStatus.Created,
      coordinatesValidated: false,
      active: true,
      updatedAt: new Date('2026-08-19T12:00:00.000Z'),
    };
    this.facilities.push(row);
    return Promise.resolve(row);
  }
  findStatusContext(
    entityType: TerritorialEntityType,
    id: string,
  ): Promise<TerritorialStatusContext | null> {
    const municipality = this.municipalities.find((row) => row.id === id);
    return Promise.resolve(
      municipality
        ? {
            id,
            entityType,
            regionId: municipality.regionId,
            operationalStatus: municipality.operationalStatus,
            active: municipality.active,
            updatedAt: municipality.updatedAt,
          }
        : null,
    );
  }
  updateStatus(input: {
    entityType: TerritorialEntityType;
    id: string;
    status: OperationalStatus;
  }): Promise<TerritorialStatusContext> {
    return Promise.resolve({
      id: input.id,
      entityType: input.entityType,
      regionId: this.regions[0].id,
      operationalStatus: input.status,
      active: true,
      updatedAt: new Date(),
    });
  }
}

describe('TerritorialCatalogUseCase', () => {
  const regionId = '11111111-1111-4111-8111-111111111111';
  const subject: AuthorizationSubject = {
    userId: 'user-1',
    roles: [RoleCode.RegionalSuperAdmin],
    permissions: [],
    territory: { national: false, regionIds: [regionId], municipalityIds: [], facilityIds: [] },
  };
  const audit = {
    actorUserId: 'user-1',
    requestId: 'request-1',
    reason: 'Configuración aprobada para el piloto',
  };
  let repository: Repository;
  let useCase: TerritorialCatalogUseCase;

  beforeEach(() => {
    repository = new Repository();
    useCase = new TerritorialCatalogUseCase(repository);
  });

  it('normaliza y crea un municipio dentro de la región asignada', async () => {
    const result = await useCase.createMunicipality(
      { regionId, officialCode: ' 0506 ', name: ' Puerto   Cortés ' },
      subject,
      audit,
    );
    expect(result).toMatchObject({ officialCode: '0506', name: 'Puerto Cortés', regionId });
  });

  it('rechaza crear un municipio fuera del alcance regional', async () => {
    repository.regions.push({ id: '22222222-2222-4222-8222-222222222222', active: true });
    await expect(
      useCase.createMunicipality(
        { regionId: repository.regions[1].id, officialCode: '0801', name: 'Distrito Central' },
        subject,
        audit,
      ),
    ).rejects.toBeInstanceOf(TerritorialScopeDeniedError);
  });

  it('limita el catálogo a municipios y establecimientos de la región asignada', async () => {
    await useCase.createMunicipality(
      { regionId, officialCode: '0506', name: 'Puerto Cortés' },
      subject,
      audit,
    );
    await useCase.createFacility(
      {
        municipalityId: 'municipality-1',
        code: 'CIS-01',
        name: 'Cornelio Moncada',
        type: 'CIS',
        address: null,
      },
      subject,
      audit,
    );
    const result = await useCase.list(subject);
    expect(result.municipalities).toHaveLength(1);
    expect(result.facilities).toHaveLength(1);
  });

  it('permite una transición territorial válida con control de versión', async () => {
    const municipality = await useCase.createMunicipality(
      { regionId, officialCode: '0506', name: 'Puerto Cortés' },
      subject,
      audit,
    );
    const result = await useCase.updateStatus(
      'MUNICIPIO',
      municipality.id,
      { status: OperationalStatus.Active, expectedUpdatedAt: municipality.updatedAt.toISOString() },
      subject,
      audit,
    );
    expect(result.operationalStatus).toBe(OperationalStatus.Active);
  });
});
