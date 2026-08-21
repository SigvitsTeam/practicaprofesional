import { AuthorizationPolicy } from '../../authorization/domain/authorization.policy';
import {
  RoleCode,
  type AuthorizationSubject,
} from '../../authorization/domain/authorization.types';
import { ExportArtifactAccessError } from '../domain/export-job';
import { DownloadExportArtifactUseCase } from './download-export-artifact.use-case';
import type { ExportArtifactStorage } from './ports/export-artifact.storage';
import type { ExportJobRepository } from './ports/export-job.repository';

const getOwnDownload = jest.fn().mockResolvedValue({
  storageKey: '11/11111111-1111-4111-8111-111111111111.xlsx',
  format: 'XLSX',
  filename: 'SIGVITS-ITS1.xlsx',
  reportType: 'ITS1_REGISTER',
  scopeLevel: 'ESTABLECIMIENTO',
  territoryId: 'facility-1',
});
const recordDownloadServed = jest.fn().mockResolvedValue(undefined);
const read = jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
const repository = {
  getOwnDownload,
  recordDownloadServed,
} as unknown as ExportJobRepository;
const storage = { read } as unknown as ExportArtifactStorage;

const allowedSubject: AuthorizationSubject = {
  userId: 'user-1',
  roles: [RoleCode.FacilityManager],
  permissions: ['exports:jobs:read', 'its1:attentions:read'],
  territory: {
    national: false,
    regionIds: [],
    municipalityIds: [],
    facilityIds: ['facility-1'],
  },
};

describe('DownloadExportArtifactUseCase', () => {
  const useCase = new DownloadExportArtifactUseCase(repository, storage, new AuthorizationPolicy());

  beforeEach(() => jest.clearAllMocks());

  it('revalidates individual permission and current facility scope before serving ITS-1', async () => {
    const result = await useCase.execute('job-1', allowedSubject, 'request-1');
    expect(result.contents).toEqual(new Uint8Array([1, 2, 3]));
    expect(read).toHaveBeenCalledTimes(1);
    expect(recordDownloadServed).toHaveBeenCalledWith('job-1', 'user-1', 'request-1', 'INDIVIDUAL');
  });

  it('denies a previously generated ITS-1 after facility scope is revoked', async () => {
    await expect(
      useCase.execute(
        'job-1',
        {
          ...allowedSubject,
          territory: { ...allowedSubject.territory, facilityIds: [] },
        },
        'request-2',
      ),
    ).rejects.toBeInstanceOf(ExportArtifactAccessError);
    expect(read).not.toHaveBeenCalled();
    expect(recordDownloadServed).not.toHaveBeenCalled();
  });
});
