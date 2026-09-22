import {
  RoleCode,
  type AuthorizationSubject,
} from '../../authorization/domain/authorization.types';
import {
  MunicipalConsolidationAccessError,
  MunicipalConsolidationNotFoundError,
} from '../domain/municipal-consolidation';
import { MunicipalConsolidationUseCase } from './municipal-consolidation.use-case';
import { MunicipalConsolidationRepository } from './ports/municipal-consolidation.repository';

const subject: AuthorizationSubject = {
  userId: 'user-1',
  roles: [RoleCode.MunicipalCoordinator],
  permissions: ['its2:reports:read', 'its2:municipal:prepare', 'its2:municipal:submit'],
  territory: {
    national: false,
    regionIds: ['region-1'],
    municipalityIds: ['municipality-1'],
    municipalityGrantIds: ['municipality-1'],
    facilityIds: [],
  },
};

const regionalReviewer: AuthorizationSubject = {
  userId: 'regional-1',
  roles: [RoleCode.RegionalAdmin],
  permissions: ['its2:reports:read', 'its2:regional:review'],
  territory: {
    national: false,
    regionIds: ['region-1'],
    regionGrantIds: ['region-1'],
    municipalityIds: ['municipality-1'],
    municipalityScopeIds: ['municipality-1'],
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
  const getCurrent = jest.fn();
  const getPreliminaryReportSource = jest.fn();
  const analyticsExecute = jest.fn();
  const repository = {
    prepare,
    getContext,
    findTerritory,
    submitToRegion,
    returnToMunicipality,
    approveRegionally,
    getCurrent,
    getPreliminaryReportSource,
    listRegionalInbox,
  } as unknown as jest.Mocked<MunicipalConsolidationRepository>;
  const useCase = new MunicipalConsolidationUseCase(repository, {
    execute: analyticsExecute,
  } as never);

  beforeEach(() => {
    jest.resetAllMocks();
    getCurrent.mockResolvedValue(undefined);
  });

  it('loads consolidation context only for assigned municipalities', async () => {
    getContext.mockResolvedValue({ municipalities: [] });
    await useCase.getContext(subject);
    expect(getContext).toHaveBeenCalledWith(['municipality-1']);
  });

  it('allows a read-only regional supervisor to list only municipalities in scope', async () => {
    const supervisor: AuthorizationSubject = {
      ...regionalReviewer,
      roles: [RoleCode.ReadOnlySupervisor],
      permissions: ['its2:reports:read'],
      territory: {
        ...regionalReviewer.territory,
        municipalityScopeIds: ['municipality-1', 'municipality-2'],
      },
    };
    getContext.mockResolvedValue({ municipalities: [] });

    await useCase.getContext(supervisor);

    expect(getContext).toHaveBeenCalledWith(['municipality-1', 'municipality-2']);
    expect(() =>
      useCase.prepare({ municipalityId: 'municipality-1', year: 2026, month: 8 }, supervisor),
    ).toThrow(MunicipalConsolidationAccessError);
    expect(prepare).not.toHaveBeenCalled();
  });

  it('allows a national read-only supervisor to list the national municipality catalog', async () => {
    const supervisor: AuthorizationSubject = {
      ...regionalReviewer,
      roles: [RoleCode.ReadOnlySupervisor],
      permissions: ['its2:reports:read'],
      territory: {
        ...regionalReviewer.territory,
        national: true,
        municipalityScopeIds: [],
      },
    };
    getContext.mockResolvedValue({ municipalities: [] });

    await useCase.getContext(supervisor);

    expect(getContext).toHaveBeenCalledWith();
  });

  it('prepares only municipalities assigned to the authenticated user', () => {
    expect(() =>
      useCase.prepare({ municipalityId: 'municipality-2', year: 2026, month: 8 }, subject),
    ).toThrow(MunicipalConsolidationAccessError);
    expect(prepare).not.toHaveBeenCalled();
  });

  it('does not treat a contextual parent municipality as a direct grant', () => {
    const contextualSubject: AuthorizationSubject = {
      ...subject,
      territory: {
        ...subject.territory,
        municipalityGrantIds: [],
        facilityIds: ['facility-1'],
      },
    };

    expect(() => useCase.getContext(contextualSubject)).toThrow(MunicipalConsolidationAccessError);
    expect(() =>
      useCase.prepare(
        { municipalityId: 'municipality-1', year: 2026, month: 8 },
        contextualSubject,
      ),
    ).toThrow(MunicipalConsolidationAccessError);
    expect(getContext).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();
  });

  it('allows read-only context without granting preparation or submission', async () => {
    const readOnlyCoordinator: AuthorizationSubject = {
      ...subject,
      permissions: ['its2:reports:read'],
    };
    getContext.mockResolvedValue({ municipalities: [] });

    await useCase.getContext(readOnlyCoordinator);
    expect(() =>
      useCase.prepare(
        { municipalityId: 'municipality-1', year: 2026, month: 8 },
        readOnlyCoordinator,
      ),
    ).toThrow(MunicipalConsolidationAccessError);
    await expect(
      useCase.submitToRegion('report-1', undefined, readOnlyCoordinator),
    ).rejects.toBeInstanceOf(MunicipalConsolidationAccessError);
    expect(getContext).toHaveBeenCalledWith(['municipality-1']);
    expect(findTerritory).not.toHaveBeenCalled();
    expect(submitToRegion).not.toHaveBeenCalled();
  });

  it('requires read permission for the municipality catalog', () => {
    const withoutRead: AuthorizationSubject = {
      ...subject,
      permissions: ['its2:municipal:prepare'],
    };

    expect(() => useCase.getContext(withoutRead)).toThrow(MunicipalConsolidationAccessError);
    expect(getContext).not.toHaveBeenCalled();
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
    await expect(
      useCase.approveRegionally('report-1', undefined, regionalReviewer),
    ).rejects.toBeInstanceOf(MunicipalConsolidationAccessError);
    expect(approveRegionally).not.toHaveBeenCalled();
  });

  it('fails before transition when the municipal consolidation is missing', async () => {
    findTerritory.mockResolvedValue(undefined);
    await expect(
      useCase.returnToMunicipality('report-1', 'Corregir', regionalReviewer),
    ).rejects.toBeInstanceOf(MunicipalConsolidationNotFoundError);
  });

  it('limits the regional inbox to assigned regions', async () => {
    listRegionalInbox.mockResolvedValue([]);
    await useCase.listRegionalInbox(2026, 8, regionalReviewer);
    expect(listRegionalInbox).toHaveBeenCalledWith({
      regionIds: ['region-1'],
      year: 2026,
      month: 8,
    });
  });

  it('rejects contextual parent regions in the regional inbox and transitions', async () => {
    const contextualReviewer: AuthorizationSubject = {
      ...regionalReviewer,
      territory: {
        ...regionalReviewer.territory,
        regionGrantIds: [],
        municipalityGrantIds: ['municipality-1'],
      },
    };
    findTerritory.mockResolvedValue({ municipalityId: 'municipality-1', regionId: 'region-1' });

    expect(() => useCase.listRegionalInbox(2026, 8, contextualReviewer)).toThrow(
      MunicipalConsolidationAccessError,
    );
    await expect(
      useCase.returnToMunicipality('report-1', 'Corregir datos', contextualReviewer),
    ).rejects.toBeInstanceOf(MunicipalConsolidationAccessError);
    await expect(
      useCase.approveRegionally('report-1', undefined, contextualReviewer),
    ).rejects.toBeInstanceOf(MunicipalConsolidationAccessError);
    expect(listRegionalInbox).not.toHaveBeenCalled();
    expect(returnToMunicipality).not.toHaveBeenCalled();
    expect(approveRegionally).not.toHaveBeenCalled();
  });

  it('keeps supervisors out of the regional workflow even with a direct region', () => {
    const supervisor: AuthorizationSubject = {
      ...regionalReviewer,
      roles: [RoleCode.ReadOnlySupervisor],
    };

    expect(() => useCase.listRegionalInbox(2026, 8, supervisor)).toThrow(
      MunicipalConsolidationAccessError,
    );
    expect(listRegionalInbox).not.toHaveBeenCalled();
  });

  it('denies municipal aggregate downloads to facility-level roles', async () => {
    const facilitySubject: AuthorizationSubject = {
      userId: 'facility-user',
      roles: [RoleCode.FacilityManager],
      permissions: ['its2:reports:read'],
      territory: {
        national: false,
        regionIds: ['region-1'],
        municipalityIds: ['municipality-1'],
        facilityIds: ['facility-1'],
      },
    };

    await expect(
      useCase.getCurrent('municipality-1', 2026, 8, facilitySubject),
    ).rejects.toBeInstanceOf(MunicipalConsolidationAccessError);
    expect(getCurrent).not.toHaveBeenCalled();
  });

  it('allows a municipal coordinator only through its direct municipal grant', async () => {
    const coordinator: AuthorizationSubject = {
      userId: 'coordinator-1',
      roles: [RoleCode.MunicipalCoordinator],
      permissions: ['its2:reports:read', 'its2:municipal:prepare'],
      territory: {
        national: false,
        regionIds: ['region-1'],
        municipalityIds: ['municipality-1'],
        municipalityGrantIds: ['municipality-1'],
        facilityIds: ['facility-1'],
      },
    };
    getPreliminaryReportSource.mockResolvedValue({
      municipality: {
        id: 'municipality-1',
        code: '0506',
        name: 'Puerto Cortés',
        regionId: 'region-1',
        regionName: 'Cortés',
      },
      facilities: [],
    });
    analyticsExecute.mockResolvedValue({
      privacy: { smallCountThreshold: 5, suppressedValue: null },
      rows: [
        {
          id: 'facility-1',
          code: 'E01',
          name: 'Hospital',
          status: 'SIN_REPORTE',
          attentions: null,
          newCases: null,
          controls: 0,
          alerts: 0,
          suppressedMetrics: ['attentions', 'newCases'],
          complementarySuppressedMetrics: [],
        },
      ],
    });

    const report = await useCase.getPreliminaryReport('municipality-1', 2026, 8, coordinator);

    expect(getPreliminaryReportSource).toHaveBeenCalledWith({
      municipalityId: 'municipality-1',
      year: 2026,
      month: 8,
    });
    expect(analyticsExecute).toHaveBeenCalledWith(
      {
        level: 'ESTABLECIMIENTO',
        municipalityId: 'municipality-1',
        year: 2026,
        month: 8,
      },
      expect.objectContaining({
        territory: expect.objectContaining({ municipalityIds: ['municipality-1'] }),
      }),
    );
    expect(report).toMatchObject({
      dataStatus: 'PRELIMINAR',
      dataSource: 'ITS1',
      rows: [expect.objectContaining({ attentions: null })],
    });
  });

  it('allows a regional reviewer only when the report belongs to its direct regional grant', async () => {
    getCurrent.mockResolvedValue({
      regionId: 'region-2',
      municipality: { id: 'municipality-2' },
    });

    await expect(
      useCase.getCurrent('municipality-2', 2026, 8, regionalReviewer),
    ).rejects.toBeInstanceOf(MunicipalConsolidationAccessError);
  });

  it.each([RoleCode.SuperAdmin, RoleCode.RegionalSuperAdmin])(
    'keeps the administrative role %s out of municipal case data',
    async (role) => {
      const administrator: AuthorizationSubject = {
        userId: 'admin-1',
        roles: [role],
        permissions: ['its2:reports:read', 'its2:regional:review'],
        territory: {
          national: role === RoleCode.SuperAdmin,
          regionIds: ['region-1'],
          regionGrantIds: ['region-1'],
          municipalityIds: ['municipality-1'],
          municipalityGrantIds: ['municipality-1'],
          facilityIds: [],
        },
      };

      await expect(
        useCase.getCurrent('municipality-1', 2026, 8, administrator),
      ).rejects.toBeInstanceOf(MunicipalConsolidationAccessError);
      expect(() => useCase.getContext(administrator)).toThrow(MunicipalConsolidationAccessError);
      expect(getContext).not.toHaveBeenCalled();
    },
  );
});
