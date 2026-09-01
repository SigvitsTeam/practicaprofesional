import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ExportConfig } from '../../../config/app.config';
import { FilesystemExportArtifactStorage } from './filesystem-export-artifact.storage';

describe('FilesystemExportArtifactStorage attempt isolation', () => {
  const jobId = '11111111-1111-4111-8111-111111111111';
  const temporaryPrefix = join(tmpdir(), 'sigvits-export-storage-');
  let directory: string;
  let storage: FilesystemExportArtifactStorage;

  beforeEach(async () => {
    directory = await mkdtemp(temporaryPrefix);
    storage = new FilesystemExportArtifactStorage({
      storageDirectory: directory,
    } as ExportConfig);
  });

  afterEach(async () => {
    if (!directory?.startsWith(temporaryPrefix) || directory === temporaryPrefix)
      throw new Error('UNSAFE_TEST_CLEANUP_PATH');
    await rm(directory, { recursive: true, force: true });
  });

  it('keeps reclaimed and old attempt contents separate even when the old worker writes last', async () => {
    const newKey = await storage.write({ id: jobId, attempts: 2 }, 'XLSX', new Uint8Array([2]));
    const oldKey = await storage.write({ id: jobId, attempts: 1 }, 'XLSX', new Uint8Array([1]));

    expect(newKey).toBe(`11/${jobId}.attempt-2.xlsx`);
    expect(oldKey).toBe(`11/${jobId}.attempt-1.xlsx`);
    await expect(storage.read(newKey)).resolves.toEqual(new Uint8Array([2]));
    await expect(storage.read(oldKey)).resolves.toEqual(new Uint8Array([1]));

    await storage.delete(oldKey);

    await expect(storage.read(newKey)).resolves.toEqual(new Uint8Array([2]));
    await expect(storage.read(oldKey)).rejects.toThrow('no está disponible');
  });

  it('can still read and expire artifacts published before attempt-scoped keys', async () => {
    const legacyKey = `11/${jobId}.pdf`;
    await mkdir(join(directory, '11'));
    await writeFile(join(directory, legacyKey), new Uint8Array([3]));

    await expect(storage.read(legacyKey)).resolves.toEqual(new Uint8Array([3]));
    await storage.delete(legacyKey);
    await expect(storage.delete(legacyKey)).resolves.toBeUndefined();
  });

  it.each([0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])(
    'rejects an invalid claim attempt: %s',
    async (attempts) => {
      await expect(
        storage.write({ id: jobId, attempts }, 'XLSX', new Uint8Array([1])),
      ).rejects.toThrow('INVALID_EXPORT_JOB_ATTEMPT');
    },
  );

  it.each(['../outside.xlsx', `22/${jobId}.attempt-1.xlsx`, `11/${jobId}.attempt-0.xlsx`])(
    'rejects an unsafe or malformed artifact key: %s',
    async (key) => {
      await expect(storage.read(key)).rejects.toThrow('INVALID_EXPORT_STORAGE_KEY');
      await expect(storage.delete(key)).rejects.toThrow('INVALID_EXPORT_STORAGE_KEY');
    },
  );
});
