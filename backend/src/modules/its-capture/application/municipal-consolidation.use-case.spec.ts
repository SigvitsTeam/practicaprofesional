import type { AuthorizationSubject } from '../../authorization/domain/authorization.types';
import {
  MunicipalConsolidationAccessError,
  MunicipalConsolidationNotFoundError,
} from '../domain/municipal-consolidation';
import { MunicipalConsolidationUseCase } from './municipal-consolidation.use-case';
import { MunicipalConsolidationRepository } from './ports/municipal-consolidation.repository';

const subject: AuthorizationSubject = {
  userId: 'user-1',
  roles: [],
  permissions: [],
  territory: {
    national: false,
    regionIds: ['region-1'],
    municipalityIds: ['municipality-1'],
    facilityIds: [],
  },
};

describe('MunicipalConsolidationUseCase', () => {
  const prepare = jest.fn();
  const getContext = jest.fn();
  const findTerritory = jest.fn();
  const submitToRegion = jest.fn();
  const returnToMunicipality = jest.fn();
  const approveRegionally = jest.fn();
  const listRegionalInbox = jest.fn();
  const repository = {
    prepare,
    getContext,
    findTerritory,
    submitToRegion,
    returnToMunicipality,
    approveRegionally,
    getCurrent: jest.fn(),
    listRegionalInbox,
  } as unknown as jest.Mocked<MunicipalConsolidationRepository>;
  const useCase = new MunicipalConsolidationUseCase(repository);

  beforeEach(() => jest.clearAllMocks());

  it('loads consolidation context only for assigned municipalities', async () => {
    getContext.mockResolvedValue({ municipalities: [] });
    await useCase.getContext(subject);
    expect(getContext).toHaveBeenCalledWith(['municipality-1']);
  });

  it('prepares only municipalities assigned to the authenticated user', () => {
    expect(() =>
      useCase.prepare({ municipalityId: 'municipality-2', year: 2026, month: 8 }, subject),
    ).toThrow(MunicipalConsolidationAccessError);
    expect(prepare).not.toHaveBeenCalled();
  });

  it('submits only a consolidation owned by the municipal scope', async () => {
    findTerritory.mockResolvedValue({ municipalityId: 'municipality-2', regionId: 'region-1' });
    await expect(useCase.submitToRegion('report-1', undefined, subject)).rejects.toBeInstanceOf(
      MunicipalConsolidationAccessError,
    );
    expect(submitToRegion).not.toHaveBeenCalled();
  });

  it('allows a regional reviewer to approve only its assigned region', async () => {
    findTerritory.mockResolvedValue({ municipalityId: 'municipality-2', regionId: 'region-2' });
    await expect(useCase.approveRegionally('report-1', undefined, subject)).rejects.toBeInstanceOf(
      MunicipalConsolidationAccessError,
    );
    expect(approveRegionally).not.toHaveBeenCalled();
  });

  it('fails before transition when the municipal consolidation is missing', async () => {
    findTerritory.mockResolvedValue(undefined);
    await expect(
      useCase.returnToMunicipality('report-1', 'Corregir', subject),
    ).rejects.toBeInstanceOf(MunicipalConsolidationNotFoundError);
  });

  it('limits the regional inbox to assigned regions', async () => {
    listRegionalInbox.mockResolvedValue([]);
    await useCase.listRegionalInbox(2026, 8, subject);
    expect(listRegionalInbox).toHaveBeenCalledWith({
      regionIds: ['region-1'],
      year: 2026,
      month: 8,
    });
  });
});
