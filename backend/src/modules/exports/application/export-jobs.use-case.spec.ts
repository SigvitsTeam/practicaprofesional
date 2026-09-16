import {
  RoleCode,
  type AuthorizationSubject,
} from '../../authorization/domain/authorization.types';
import {
  ExportJobScopeError,
  InvalidExportJobError,
  type CreateExportJobInput,
  type ExportJob,
} from '../domain/export-job';
import { ExportJobsUseCase } from './export-jobs.use-case';
import { ExportJobRepository } from './ports/export-job.repository';

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
    const result = await new ExportJobsUseCase(repository).create(base, subject);
    expect(result.status).toBe('PENDIENTE');
    expect(repository.created?.requestedByUserId).toBe('user-1');
  });

  it('rejects a territory outside the subject scope', () => {
    expect(() =>
      new ExportJobsUseCase(new Repository()).create(
        { ...base, territoryId: 'municipality-2' },
        subject,
      ),
    ).toThrow(ExportJobScopeError);
  });

  it('does not elevate contextual parent IDs from a facility assignment', () => {
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
    const jobs = new ExportJobsUseCase(new Repository());

    expect(() => jobs.create(base, facilityOnly)).toThrow(ExportJobScopeError);
    expect(() =>
      jobs.create(
        {
          ...base,
          reportType: 'REGIONAL_CONSOLIDATED',
          scopeLevel: 'REGION',
          territoryId: 'region-1',
        },
        facilityOnly,
      ),
    ).toThrow(ExportJobScopeError);
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
    const jobs = new ExportJobsUseCase(new Repository());

    await expect(jobs.create(base, municipalOnly)).resolves.toMatchObject({
      scopeLevel: 'MUNICIPIO',
      territoryId: 'municipality-1',
    });
    expect(() =>
      jobs.create(
        {
          ...base,
          reportType: 'REGIONAL_CONSOLIDATED',
          scopeLevel: 'REGION',
          territoryId: 'region-1',
        },
        municipalOnly,
      ),
    ).toThrow(ExportJobScopeError);
  });

  it('denies case exports to administrative superadmins even with residual permissions', () => {
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

    expect(() =>
      new ExportJobsUseCase(new Repository()).create(
        {
          ...base,
          reportType: 'NATIONAL_CONSOLIDATED',
          scopeLevel: 'NACIONAL',
          territoryId: null,
        },
        administrative,
      ),
    ).toThrow(ExportJobScopeError);
  });

  it('queues ITS-2 only for an authorized establishment', async () => {
    const repository = new Repository();
    const result = await new ExportJobsUseCase(repository).create(
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

  it('rejects ITS-2 with a broader territorial scope', () => {
    expect(() =>
      new ExportJobsUseCase(new Repository()).create(
        { ...base, reportType: 'ITS2_MONTHLY' },
        subject,
      ),
    ).toThrow(InvalidExportJobError);
  });

  it('queues a municipal consolidation only at municipal scope', async () => {
    const repository = new Repository();
    const result = await new ExportJobsUseCase(repository).create(
      { ...base, reportType: 'MUNICIPAL_CONSOLIDATED' },
      subject,
    );
    expect(result.reportType).toBe('MUNICIPAL_CONSOLIDATED');
  });

  it('rejects a consolidation whose type and scope do not match', () => {
    expect(() =>
      new ExportJobsUseCase(new Repository()).create(
        { ...base, reportType: 'NATIONAL_CONSOLIDATED' },
        subject,
      ),
    ).toThrow(InvalidExportJobError);
  });

  it('creates an ITS-1 job only through the individual-data command', async () => {
    const repository = new Repository();
    const result = await new ExportJobsUseCase(repository).createIts1(
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
    const result = await new ExportJobsUseCase(repository).create(
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

  it('rejects annual ranges that could monopolize the export worker', () => {
    expect(() =>
      new ExportJobsUseCase(new Repository()).create(
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
    ).toThrow(InvalidExportJobError);
  });
});
