import type { AuthorizationSubject } from '../../authorization/domain/authorization.types';
import { RegionalConsolidationAccessError } from '../domain/regional-consolidation';
import { RegionalConsolidationUseCase } from './regional-consolidation.use-case';
import { RegionalConsolidationRepository } from './ports/regional-consolidation.repository';

const regionalSubject: AuthorizationSubject = {
  userId: 'regional-1',
  roles: [],
  permissions: [],
  territory: { national: false, regionIds: ['region-1'], municipalityIds: [], facilityIds: [] },
};
const centralSubject: AuthorizationSubject = {
  userId: 'central-1',
  roles: [],
  permissions: [],
  territory: { national: true, regionIds: [], municipalityIds: [], facilityIds: [] },
};

describe('RegionalConsolidationUseCase', () => {
  const prepare = jest.fn();
  const listCentralInbox = jest.fn();
  const repository = {
    getContext: jest.fn(),
    prepare,
    findRegionId: jest.fn(),
    submitToCentral: jest.fn(),
    returnToRegion: jest.fn(),
    approveCentrally: jest.fn(),
    getCurrent: jest.fn(),
    listCentralInbox,
  } as unknown as jest.Mocked<RegionalConsolidationRepository>;
  const useCase = new RegionalConsolidationUseCase(repository);

  beforeEach(() => jest.clearAllMocks());

  it('prepares only regions assigned to the authenticated administrator', () => {
    expect(() =>
      useCase.prepare({ regionId: 'region-2', year: 2026, month: 8 }, regionalSubject),
    ).toThrow(RegionalConsolidationAccessError);
    expect(prepare).not.toHaveBeenCalled();
  });

  it('restricts central review to national scope', () => {
    expect(() => useCase.listCentralInbox(2026, 8, regionalSubject)).toThrow(
      RegionalConsolidationAccessError,
    );
    expect(listCentralInbox).not.toHaveBeenCalled();
  });

  it('allows national scope to list regional consolidations', async () => {
    listCentralInbox.mockResolvedValue([]);
    await useCase.listCentralInbox(2026, 8, centralSubject);
    expect(listCentralInbox).toHaveBeenCalledWith({ year: 2026, month: 8 });
  });
});
