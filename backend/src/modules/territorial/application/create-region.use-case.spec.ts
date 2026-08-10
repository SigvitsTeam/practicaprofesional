import { CreateRegionUseCase } from './create-region.use-case';
import { RegionRepository } from './ports/region.repository';
import {
  OperationalStatus,
  RegionCodeAlreadyExistsError,
  RegionType,
  type AuditContext,
  type NewRegion,
  type Region,
} from '../domain/region';

class InMemoryRegionRepository extends RegionRepository {
  readonly regions: Region[] = [];
  lastAudit?: AuditContext;

  findByCode(code: string): Promise<Region | null> {
    return Promise.resolve(this.regions.find((region) => region.code === code) ?? null);
  }

  create(newRegion: NewRegion, audit: AuditContext): Promise<Region> {
    const now = new Date('2026-08-10T12:00:00.000Z');
    const region: Region = {
      ...newRegion,
      id: `region-${this.regions.length + 1}`,
      operationalStatus: OperationalStatus.Created,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    this.regions.push(region);
    this.lastAudit = audit;
    return Promise.resolve(region);
  }

  listActive(regionIds?: readonly string[]): Promise<Region[]> {
    return Promise.resolve(
      this.regions.filter(
        (region) => region.active && (!regionIds || regionIds.includes(region.id)),
      ),
    );
  }
}

describe('CreateRegionUseCase', () => {
  const audit: AuditContext = { actorUserId: 'actor-1', requestId: 'request-1' };
  let repository: InMemoryRegionRepository;
  let useCase: CreateRegionUseCase;

  beforeEach(() => {
    repository = new InMemoryRegionRepository();
    useCase = new CreateRegionUseCase(repository);
  });

  it('normalizes and persists a valid region with its audit context', async () => {
    const region = await useCase.execute({
      code: '  r-cortes ',
      name: ' Región   Sanitaria de Cortés ',
      regionNumber: ' 3 ',
      type: RegionType.Health,
      audit,
    });

    expect(region).toMatchObject({
      code: 'R-CORTES',
      name: 'Región Sanitaria de Cortés',
      regionNumber: '3',
      type: RegionType.Health,
    });
    expect(repository.lastAudit).toEqual(audit);
  });

  it('rejects a duplicate normalized code', async () => {
    await useCase.execute({
      code: 'R-CORTES',
      name: 'Región Sanitaria de Cortés',
      type: RegionType.Health,
      audit,
    });

    await expect(
      useCase.execute({
        code: ' r-cortes ',
        name: 'Otra región',
        type: RegionType.Health,
        audit,
      }),
    ).rejects.toBeInstanceOf(RegionCodeAlreadyExistsError);
  });

  it.each(['A', 'con espacios', '../CORTES', ''])('rejects the invalid code %j', async (code) => {
    await expect(
      useCase.execute({ code, name: 'Región válida', type: RegionType.Health, audit }),
    ).rejects.toThrow('El código debe contener entre 2 y 30 caracteres');
  });
});
