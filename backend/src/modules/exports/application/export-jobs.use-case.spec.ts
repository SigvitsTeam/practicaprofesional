import {
  RoleCode,
  type AuthorizationSubject,
} from '../../authorization/domain/authorization.types';
import {
  ExportJobScopeError,
  InvalidExportJobError,
  type CreateExportJobInput,
  type ExportJob,
  type MunicipalConsolidatedExportParameters,
  type ResolvedMunicipalExportRange,
} from '../domain/export-job';
import { ExportJobsUseCase } from './export-jobs.use-case';
import { ExportJobRepository } from './ports/export-job.repository';
import { MunicipalIts2ExportRepository } from './ports/municipal-its2-export.repository';

class Repository extends ExportJobRepository {
  created?: CreateExportJobInput;
  listOwn(): Promise<ExportJob[]> {
    return Promise.resolve([]);
  }
  create(input: CreateExportJobInput): Promise<ExportJob> {
    this.created = input;
    return Promise.resolve({
      id: 'job-1',
      reportType: input.reportType,
      format: input.format,
      scopeLevel: input.scopeLevel,
      territoryId: input.territoryId,
      year: input.year,
      month: input.month,
      parameters: input.parameters ?? null,
      status: 'PENDIENTE',
      attempts: 0,
      outputAvailable: false,
      outputExpiresAt: null,
      errorCode: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  claimNext(): Promise<null> {
    return Promise.resolve(null);
  }
  recoverStaleExhausted(): Promise<number> {
    return Promise.resolve(0);
  }
  complete(): Promise<boolean> {
    return Promise.resolve(true);
  }
  fail(): Promise<boolean> {
    return Promise.resolve(true);
  }
  listExpiredArtifacts(): Promise<[]> {
    return Promise.resolve([]);
  }
  clearArtifact(): Promise<boolean> {
    return Promise.resolve(true);
  }
  getOwnDownload(): Promise<never> {
    return Promise.reject(new Error('not implemented'));
  }
  recordDownloadServed(): Promise<void> {
    return Promise.resolve();
  }
}

class MunicipalRepository extends MunicipalIts2ExportRepository {
  requested?: MunicipalConsolidatedExportParameters;

  resolveRange(
    parameters: MunicipalConsolidatedExportParameters,
  ): Promise<ResolvedMunicipalExportRange> {
    this.requested = parameters;
    const epidemiological = parameters.timeUnit === 'EPIDEMIOLOGICAL_WEEK';
    return Promise.resolve({
      parameters,
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-03-31T00:00:00.000Z'),
      anchorYear: 2026,
      anchorMonth: 3,
      periodLabel: epidemiological ? 'SE01–SE08' : '01–03',
      yearLabel: '2026',
      filenameLabel: epidemiological ? 'SE-2026-W01_a_2026-W08' : 'MES-2026-01_a_2026-03',
      epidemiologicalWeekIds: epidemiological ? ['week-1', 'week-8'] : undefined,
    });
  }

  getReportSource(): Promise<never> {
    return Promise.reject(new Error('not implemented'));
  }
}

function useCase(
  repository: Repository = new Repository(),
  municipal: MunicipalRepository = new MunicipalRepository(),
): ExportJobsUseCase {
  return new ExportJobsUseCase(repository, municipal);
}

const subject: AuthorizationSubject = {
  userId: 'user-1',
  roles: [RoleCode.CoordinationDataEntry],
  permissions: ['exports:jobs:create'],
  territory: {
    national: false,
    regionIds: ['region-1'],
    regionGrantIds: ['region-1'],
    municipalityIds: ['municipality-1'],
    municipalityScopeIds: ['municipality-1'],
    facilityIds: ['facility-1'],
    facilityGrantIds: ['facility-1'],
  },
};
const base = {
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
  reportType: 'TERRITORIAL_SUMMARY',
  format: 'XLSX' as const,
  scopeLevel: 'MUNICIPIO' as const,
  territoryId: 'municipality-1',
  year: 2026,
  month: 8,
  requestId: 'request-1',
};

describe('ExportJobsUseCase', () => {
  it('queues a bounded export inside the authorized scope', async () => {
    const repository = new Repository();
    const result = await useCase(repository).create(base, subject);
    expect(result.status).toBe('PENDIENTE');
    expect(repository.created?.requestedByUserId).toBe('user-1');
  });

  it('rejects a territory outside the subject scope', async () => {
    await expect(
      useCase().create({ ...base, territoryId: 'municipality-2' }, subject),
    ).rejects.toThrow(ExportJobScopeError);
  });

  it('does not elevate contextual parent IDs from a facility assignment', async () => {
    const facilityOnly: AuthorizationSubject = {
      ...subject,
      roles: [RoleCode.FacilityManager],
      territory: {
        national: false,
        regionIds: ['region-1'],
        regionGrantIds: [],
        municipalityIds: ['municipality-1'],
        municipalityScopeIds: [],
        municipalityGrantIds: [],
        facilityIds: ['facility-1'],
        facilityGrantIds: ['facility-1'],
      },
    };
    const jobs = useCase();

    await expect(jobs.create(base, facilityOnly)).rejects.toThrow(ExportJobScopeError);
    await expect(
      jobs.create(
        {
          ...base,
          reportType: 'REGIONAL_CONSOLIDATED',
          scopeLevel: 'REGION',
          territoryId: 'region-1',
        },
        facilityOnly,
      ),
    ).rejects.toThrow(ExportJobScopeError);
  });

  it('does not elevate a direct municipality assignment to its contextual region', async () => {
    const municipalOnly: AuthorizationSubject = {
      ...subject,
      roles: [RoleCode.MunicipalCoordinator],
      territory: {
        national: false,
        regionIds: ['region-1'],
        regionGrantIds: [],
        municipalityIds: ['municipality-1'],
        municipalityScopeIds: ['municipality-1'],
        municipalityGrantIds: ['municipality-1'],
        facilityIds: ['facility-1'],
        facilityGrantIds: [],
      },
    };
    const jobs = useCase();

    await expect(jobs.create(base, municipalOnly)).resolves.toMatchObject({
      scopeLevel: 'MUNICIPIO',
      territoryId: 'municipality-1',
    });
    await expect(
      jobs.create(
        {
          ...base,
          reportType: 'REGIONAL_CONSOLIDATED',
          scopeLevel: 'REGION',
          territoryId: 'region-1',
        },
        municipalOnly,
      ),
    ).rejects.toThrow(ExportJobScopeError);
  });

  it('denies case exports to administrative superadmins even with residual permissions', async () => {
    const administrative: AuthorizationSubject = {
      ...subject,
      roles: [RoleCode.SuperAdmin],
      permissions: ['*'],
      territory: {
        national: true,
        regionIds: [],
        municipalityIds: [],
        municipalityScopeIds: [],
        facilityIds: [],
      },
    };

    await expect(
      useCase().create(
        {
          ...base,
          reportType: 'NATIONAL_CONSOLIDATED',
          scopeLevel: 'NACIONAL',
          territoryId: null,
        },
        administrative,
      ),
    ).rejects.toThrow(ExportJobScopeError);
  });

  it('queues ITS-2 only for an authorized establishment', async () => {
    const repository = new Repository();
    const result = await useCase(repository).create(
      {
        ...base,
        reportType: 'ITS2_MONTHLY',
        scopeLevel: 'ESTABLECIMIENTO',
        territoryId: 'facility-1',
      },
      subject,
    );
    expect(result.reportType).toBe('ITS2_MONTHLY');
  });

  it('rejects ITS-2 with a broader territorial scope', async () => {
    await expect(
      useCase().create({ ...base, reportType: 'ITS2_MONTHLY' }, subject),
    ).rejects.toThrow(InvalidExportJobError);
  });

  it('queues a municipal consolidation only at municipal scope', async () => {
    const repository = new Repository();
    const result = await useCase(repository).create(
      { ...base, reportType: 'MUNICIPAL_CONSOLIDATED' },
      subject,
    );
    expect(result.reportType).toBe('MUNICIPAL_CONSOLIDATED');
  });

  it('rejects a consolidation whose type and scope do not match', async () => {
    await expect(
      useCase().create({ ...base, reportType: 'NATIONAL_CONSOLIDATED' }, subject),
    ).rejects.toThrow(InvalidExportJobError);
  });

  it('creates an ITS-1 job only through the individual-data command', async () => {
    const repository = new Repository();
    const result = await useCase(repository).createIts1(
      {
        idempotencyKey: base.idempotencyKey,
        format: 'XLSX',
        facilityId: 'facility-1',
        year: 2026,
        month: 8,
        requestId: 'request-1',
      },
      subject,
    );
    expect(result.reportType).toBe('ITS1_REGISTER');
    expect(repository.created?.scopeLevel).toBe('ESTABLECIMIENTO');
  });

  it('queues a bounded annual comparison with normalized parameters', async () => {
    const repository = new Repository();
    const result = await useCase(repository).create(
      {
        ...base,
        reportType: 'ANNUAL_COMPARISON',
        parameters: {
          dimension: 'periods',
          rangeAStart: '2025-01',
          rangeAEnd: '2025-12',
          rangeBStart: '2026-01',
          rangeBEnd: '2026-08',
          indicatorA: 'TOTAL_CASES',
          indicatorB: 'RATE_PER_1000',
        },
      },
      subject,
    );
    expect(result.reportType).toBe('ANNUAL_COMPARISON');
    expect(repository.created?.parameters?.['rangeAStart']).toBe('2025-01');
  });

  it('rejects annual ranges that could monopolize the export worker', async () => {
    await expect(
      useCase().create(
        {
          ...base,
          reportType: 'ANNUAL_COMPARISON',
          parameters: {
            dimension: 'periods',
            rangeAStart: '2020-01',
            rangeAEnd: '2025-12',
            rangeBStart: '2026-01',
            rangeBEnd: '2026-08',
            indicatorA: 'TOTAL_CASES',
            indicatorB: 'NEW_CASES',
          },
        },
        subject,
      ),
    ).rejects.toThrow(InvalidExportJobError);
  });

  it('derives the persisted anchor from a validated inclusive monthly range', async () => {
    const repository = new Repository();
    const municipal = new MunicipalRepository();

    await useCase(repository, municipal).create(
      {
        ...base,
        reportType: 'MUNICIPAL_CONSOLIDATED',
        year: undefined,
        month: undefined,
        parameters: {
          timeUnit: 'MONTH',
          startPeriod: '2026-01',
          endPeriod: '2026-03',
        },
      },
      subject,
    );

    expect(municipal.requested).toEqual({
      timeUnit: 'MONTH',
      startPeriod: '2026-01',
      endPeriod: '2026-03',
    });
    expect(repository.created).toMatchObject({
      year: 2026,
      month: 3,
      parameters: municipal.requested,
    });
  });

  it('accepts an epidemiological-week range without legacy year and month', async () => {
    const repository = new Repository();

    await useCase(repository).create(
      {
        ...base,
        reportType: 'MUNICIPAL_CONSOLIDATED',
        year: undefined,
        month: undefined,
        parameters: {
          timeUnit: 'EPIDEMIOLOGICAL_WEEK',
          startPeriod: '2026-W01',
          endPeriod: '2026-W08',
        },
      },
      subject,
    );

    expect(repository.created).toMatchObject({ year: 2026, month: 3 });
  });

  it('rejects unexpected municipal range parameters', async () => {
    await expect(
      useCase().create(
        {
          ...base,
          reportType: 'MUNICIPAL_CONSOLIDATED',
          parameters: {
            timeUnit: 'MONTH',
            startPeriod: '2026-01',
            endPeriod: '2026-03',
            exposeExactSmallCounts: true,
          },
        },
        subject,
      ),
    ).rejects.toThrow(InvalidExportJobError);
  });
});
