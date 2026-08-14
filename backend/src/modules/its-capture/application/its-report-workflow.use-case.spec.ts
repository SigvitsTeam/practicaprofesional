import type { AuthorizationSubject } from '../../authorization/domain/authorization.types';
import { ItsReportAccessError, ItsReportNotFoundError } from '../domain/its-report-workflow';
import { ItsReportWorkflowUseCase } from './its-report-workflow.use-case';
import { ItsReportWorkflowRepository } from './ports/its-report-workflow.repository';

const subject: AuthorizationSubject = {
  userId: 'user-1',
  roles: [],
  permissions: [],
  territory: {
    national: false,
    regionIds: ['region-1'],
    municipalityIds: ['municipality-1'],
    facilityIds: ['facility-1'],
  },
};

describe('ItsReportWorkflowUseCase', () => {
  const prepare = jest.fn();
  const findTerritory = jest.fn();
  const approveMunicipally = jest.fn();
  const listMunicipalInbox = jest.fn();
  const repository = {
    prepare,
    findTerritory,
    submit: jest.fn(),
    returnToFacility: jest.fn(),
    approveMunicipally,
    getCurrent: jest.fn(),
    listMunicipalInbox,
  } as unknown as jest.Mocked<ItsReportWorkflowRepository>;
  const useCase = new ItsReportWorkflowUseCase(repository);

  beforeEach(() => jest.clearAllMocks());

  it('prepares only facilities assigned to the authenticated user', () => {
    expect(() =>
      useCase.prepare({ facilityId: 'facility-2', year: 2026, month: 8 }, subject),
    ).toThrow(ItsReportAccessError);
    expect(prepare).not.toHaveBeenCalled();
  });

  it('prevents a municipal reviewer from approving a report outside its municipalities', async () => {
    findTerritory.mockResolvedValue({
      facilityId: 'facility-2',
      municipalityId: 'municipality-2',
    });
    await expect(useCase.approveMunicipally('report-1', undefined, subject)).rejects.toBeInstanceOf(
      ItsReportAccessError,
    );
    expect(approveMunicipally).not.toHaveBeenCalled();
  });

  it('reports a missing workflow report before a transition', async () => {
    findTerritory.mockResolvedValue(undefined);
    await expect(useCase.submit('report-1', subject)).rejects.toBeInstanceOf(
      ItsReportNotFoundError,
    );
  });

  it('lists only the municipal inbox for the authenticated territory', async () => {
    listMunicipalInbox.mockResolvedValue([]);
    await useCase.listMunicipalInbox(2026, 8, subject);
    expect(listMunicipalInbox).toHaveBeenCalledWith({
      municipalityIds: ['municipality-1'],
      year: 2026,
      month: 8,
    });
  });
});
