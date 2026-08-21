import type { AuthorizationSubject } from '../../authorization/domain/authorization.types';
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
  complete(): Promise<void> {
    return Promise.resolve();
  }
  fail(): Promise<void> {
    return Promise.resolve();
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
  roles: [],
  permissions: ['exports:jobs:create'],
  territory: {
    national: false,
    regionIds: ['region-1'],
    municipalityIds: ['municipality-1'],
    facilityIds: ['facility-1'],
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
});
