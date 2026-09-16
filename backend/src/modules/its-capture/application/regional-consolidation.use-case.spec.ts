import {
  RoleCode,
  type AuthorizationSubject,
} from '../../authorization/domain/authorization.types';
import { RegionalConsolidationAccessError } from '../domain/regional-consolidation';
import { RegionalConsolidationUseCase } from './regional-consolidation.use-case';
import { RegionalConsolidationRepository } from './ports/regional-consolidation.repository';

const regionalSubject: AuthorizationSubject = {
  userId: 'regional-1',
  roles: [RoleCode.RegionalAdmin],
  permissions: ['its2:reports:read', 'its2:regional:prepare', 'its2:regional:submit'],
  territory: {
    national: false,
    regionIds: ['region-1'],
    regionGrantIds: ['region-1'],
    municipalityIds: [],
    facilityIds: [],
  },
};
const centralSubject: AuthorizationSubject = {
  userId: 'central-1',
  roles: [RoleCode.CentralAdmin],
  permissions: ['its2:reports:read', 'its2:central:review'],
  territory: { national: true, regionIds: [], municipalityIds: [], facilityIds: [] },
};

describe('RegionalConsolidationUseCase', () => {
  const getContext = jest.fn();
  const prepare = jest.fn();
  const findRegionId = jest.fn();
  const submitToCentral = jest.fn();
  const getCurrent = jest.fn();
  const listCentralInbox = jest.fn();
  const repository = {
    getContext,
    prepare,
    findRegionId,
    submitToCentral,
    returnToRegion: jest.fn(),
    approveCentrally: jest.fn(),
    getCurrent,
    listCentralInbox,
  } as unknown as jest.Mocked<RegionalConsolidationRepository>;
  const useCase = new RegionalConsolidationUseCase(repository);

  beforeEach(() => jest.clearAllMocks());

  it('loads context only from direct regional grants', async () => {
    getContext.mockResolvedValue({ regions: [] });

    await useCase.getContext(regionalSubject);

    expect(getContext).toHaveBeenCalledWith(['region-1']);
  });

  it('prepares only regions assigned to the authenticated administrator', () => {
    expect(() =>
      useCase.prepare({ regionId: 'region-2', year: 2026, month: 8 }, regionalSubject),
    ).toThrow(RegionalConsolidationAccessError);
    expect(prepare).not.toHaveBeenCalled();
  });

  it('does not treat a contextual parent region as a regional grant', () => {
    const contextualSubject: AuthorizationSubject = {
      ...regionalSubject,
      territory: {
        ...regionalSubject.territory,
        regionGrantIds: [],
        municipalityIds: ['municipality-1'],
        facilityIds: ['facility-1'],
      },
    };

    expect(() => useCase.getContext(contextualSubject)).toThrow(RegionalConsolidationAccessError);
    expect(() =>
      useCase.prepare({ regionId: 'region-1', year: 2026, month: 8 }, contextualSubject),
    ).toThrow(RegionalConsolidationAccessError);
    expect(() => useCase.getCurrent('region-1', 2026, 8, contextualSubject)).toThrow(
      RegionalConsolidationAccessError,
    );
    expect(getContext).not.toHaveBeenCalled();
    expect(getCurrent).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();
  });

  it('keeps read-only supervisors out of regional workflow data', () => {
    const supervisor: AuthorizationSubject = {
      ...regionalSubject,
      roles: [RoleCode.ReadOnlySupervisor],
      permissions: ['its2:reports:read'],
    };

    expect(() => useCase.getCurrent('region-1', 2026, 8, supervisor)).toThrow(
      RegionalConsolidationAccessError,
    );
    expect(getCurrent).not.toHaveBeenCalled();
  });

  it('requires the exact regional permission for preparation and submission', async () => {
    const readOnlyRegional: AuthorizationSubject = {
      ...regionalSubject,
      permissions: ['its2:reports:read'],
    };

    expect(() => useCase.getContext(readOnlyRegional)).toThrow(RegionalConsolidationAccessError);
    expect(() =>
      useCase.prepare({ regionId: 'region-1', year: 2026, month: 8 }, readOnlyRegional),
    ).toThrow(RegionalConsolidationAccessError);
    await expect(
      useCase.submitToCentral('report-1', undefined, readOnlyRegional),
    ).rejects.toBeInstanceOf(RegionalConsolidationAccessError);
    expect(getContext).not.toHaveBeenCalled();
    expect(findRegionId).not.toHaveBeenCalled();
    expect(submitToCentral).not.toHaveBeenCalled();
  });

  it('revalidates the direct region before submitting a stored report', async () => {
    findRegionId.mockResolvedValue('region-1');
    const contextualSubject: AuthorizationSubject = {
      ...regionalSubject,
      territory: { ...regionalSubject.territory, regionGrantIds: [] },
    };

    await expect(
      useCase.submitToCentral('report-1', undefined, contextualSubject),
    ).rejects.toBeInstanceOf(RegionalConsolidationAccessError);
    expect(submitToCentral).not.toHaveBeenCalled();
  });

  it('allows the assigned regional administrator to submit its report', async () => {
    findRegionId.mockResolvedValue('region-1');
    submitToCentral.mockResolvedValue({ id: 'report-1' });

    await useCase.submitToCentral('report-1', undefined, regionalSubject);

    expect(submitToCentral).toHaveBeenCalledWith('report-1', 'regional-1', undefined);
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

  it('does not grant central review from national scope alone', () => {
    const wrongRole: AuthorizationSubject = {
      ...centralSubject,
      roles: [RoleCode.ReadOnlySupervisor],
    };

    expect(() => useCase.listCentralInbox(2026, 8, wrongRole)).toThrow(
      RegionalConsolidationAccessError,
    );
    expect(listCentralInbox).not.toHaveBeenCalled();
  });

  it('does not grant central review without its workflow permission', () => {
    const missingPermission: AuthorizationSubject = {
      ...centralSubject,
      permissions: ['its2:reports:read'],
    };

    expect(() => useCase.listCentralInbox(2026, 8, missingPermission)).toThrow(
      RegionalConsolidationAccessError,
    );
    expect(listCentralInbox).not.toHaveBeenCalled();
  });

  it('allows a central reviewer to read a regional consolidation', async () => {
    getCurrent.mockResolvedValue(undefined);

    await useCase.getCurrent('region-2', 2026, 8, centralSubject);

    expect(getCurrent).toHaveBeenCalledWith({
      regionId: 'region-2',
      year: 2026,
      month: 8,
    });
  });

  it.each([RoleCode.SuperAdmin, RoleCode.RegionalSuperAdmin])(
    'keeps administrative role %s out of the regional workflow',
    (role) => {
      const administrator: AuthorizationSubject = {
        ...regionalSubject,
        roles: [role, RoleCode.RegionalAdmin],
        permissions: ['*'],
      };

      expect(() => useCase.getCurrent('region-1', 2026, 8, administrator)).toThrow(
        RegionalConsolidationAccessError,
      );
      expect(getCurrent).not.toHaveBeenCalled();
    },
  );
});
