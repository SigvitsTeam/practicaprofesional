import {
  RoleCode,
  type AuthorizationSubject,
} from '../../authorization/domain/authorization.types';
import { ItsReportAccessError, ItsReportNotFoundError } from '../domain/its-report-workflow';
import { ItsReportWorkflowUseCase } from './its-report-workflow.use-case';
import { ItsReportWorkflowRepository } from './ports/its-report-workflow.repository';

const subject: AuthorizationSubject = {
  userId: 'user-1',
  roles: [RoleCode.CoordinationDataEntry],
  permissions: [],
  territory: {
    national: false,
    regionIds: ['region-1'],
    municipalityIds: ['municipality-1'],
    facilityIds: ['facility-1'],
    facilityGrantIds: [],
  },
};

describe('ItsReportWorkflowUseCase', () => {
  const prepare = jest.fn();
  const findTerritory = jest.fn();
  const approveMunicipally = jest.fn();
  const listMunicipalInbox = jest.fn();
  const getContext = jest.fn();
  const getCurrent = jest.fn();
  const submit = jest.fn();
  const repository = {
    getContext,
    prepare,
    findTerritory,
    submit,
    returnToFacility: jest.fn(),
    approveMunicipally,
    getCurrent,
    listMunicipalInbox,
  } as unknown as jest.Mocked<ItsReportWorkflowRepository>;
  const useCase = new ItsReportWorkflowUseCase(repository);

  beforeEach(() => jest.clearAllMocks());

  it('loads only assigned facilities for municipal and regional report contexts', async () => {
    getContext.mockResolvedValue({ facilities: [] });

    await useCase.getContext(subject);

    expect(getContext).toHaveBeenCalledWith(['facility-1']);
  });

  it('expands a national report context to every active facility and reads any facility', async () => {
    const national: AuthorizationSubject = {
      ...subject,
      roles: [RoleCode.CentralAdmin],
      territory: {
        national: true,
        regionIds: [],
        municipalityIds: [],
        facilityIds: [],
      },
    };
    getContext.mockResolvedValue({ facilities: [] });
    getCurrent.mockResolvedValue({});

    await expect(useCase.getContext(national)).resolves.toEqual({ facilities: [] });
    await expect(useCase.getCurrent('facility-anywhere', 2026, 8, national)).resolves.toEqual({});

    expect(getContext).toHaveBeenCalledWith(undefined);
    expect(getCurrent).toHaveBeenCalledWith({
      facilityId: 'facility-anywhere',
      year: 2026,
      month: 8,
    });
  });

  it('prepares only facilities assigned to the authenticated user', () => {
    expect(() =>
      useCase.prepare({ facilityId: 'facility-2', year: 2026, month: 8 }, subject),
    ).toThrow(ItsReportAccessError);
    expect(prepare).not.toHaveBeenCalled();
  });

  it('denies ITS 2 reads and operations inherited by a facility manager from a broader scope', async () => {
    const inheritedFacilityManager: AuthorizationSubject = {
      ...subject,
      roles: [RoleCode.FacilityManager],
      territory: {
        ...subject.territory,
        facilityIds: ['facility-1'],
        facilityGrantIds: [],
      },
    };

    expect(() =>
      useCase.prepare({ facilityId: 'facility-1', year: 2026, month: 8 }, inheritedFacilityManager),
    ).toThrow(ItsReportAccessError);
    expect(() => useCase.getCurrent('facility-1', 2026, 8, inheritedFacilityManager)).toThrow(
      ItsReportAccessError,
    );

    findTerritory.mockResolvedValue({
      facilityId: 'facility-1',
      municipalityId: 'municipality-1',
    });
    await expect(useCase.submit('report-1', inheritedFacilityManager)).rejects.toBeInstanceOf(
      ItsReportAccessError,
    );

    expect(prepare).not.toHaveBeenCalled();
    expect(getCurrent).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it('allows ITS 2 reads and operations for a facility manager with a direct grant', async () => {
    const directFacilityManager: AuthorizationSubject = {
      ...subject,
      roles: [RoleCode.FacilityManager],
      territory: {
        ...subject.territory,
        facilityGrantIds: ['facility-1'],
      },
    };
    prepare.mockResolvedValueOnce({});
    getCurrent.mockResolvedValueOnce({});
    findTerritory.mockResolvedValueOnce({
      facilityId: 'facility-1',
      municipalityId: 'municipality-1',
    });
    submit.mockResolvedValueOnce({});

    await expect(
      useCase.prepare({ facilityId: 'facility-1', year: 2026, month: 8 }, directFacilityManager),
    ).resolves.toEqual({});
    await expect(useCase.getCurrent('facility-1', 2026, 8, directFacilityManager)).resolves.toEqual(
      {},
    );
    await expect(useCase.submit('report-1', directFacilityManager)).resolves.toEqual({});
  });

  it('keeps descendant-facility ITS 2 access for municipal coordination data entry', async () => {
    prepare.mockResolvedValueOnce({});
    getCurrent.mockResolvedValueOnce({});
    findTerritory.mockResolvedValueOnce({
      facilityId: 'facility-1',
      municipalityId: 'municipality-1',
    });
    submit.mockResolvedValueOnce({});

    await expect(
      useCase.prepare({ facilityId: 'facility-1', year: 2026, month: 8 }, subject),
    ).resolves.toEqual({});
    await expect(useCase.getCurrent('facility-1', 2026, 8, subject)).resolves.toEqual({});
    await expect(useCase.submit('report-1', subject)).resolves.toEqual({});
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
