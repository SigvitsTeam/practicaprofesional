import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { access, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, resolve, sep } from 'node:path';
import { exportConfig } from '../../../config/app.config';
import { ExportArtifactStorage } from '../application/ports/export-artifact.storage';
import type { ExportFormat, ExportJobClaim } from '../domain/export-job';
import { ExportArtifactNotFoundError } from '../domain/export-job';

@Injectable()
export class FilesystemExportArtifactStorage extends ExportArtifactStorage {
  private readonly root: string;

  constructor(@Inject(exportConfig.KEY) config: ConfigType<typeof exportConfig>) {
    super();
    this.root = resolve(config.storageDirectory);
  }

  async write(claim: ExportJobClaim, format: ExportFormat, contents: Uint8Array): Promise<string> {
    const { id: jobId, attempts } = claim;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId))
      throw new Error('INVALID_EXPORT_JOB_ID');
    if (!Number.isSafeInteger(attempts) || attempts < 1)
      throw new Error('INVALID_EXPORT_JOB_ATTEMPT');
    const extension = format.toLowerCase();
    const relativeKey = `${jobId.slice(0, 2)}/${jobId}.attempt-${attempts}.${extension}`;
    const target = this.resolveKey(relativeKey);
    await mkdir(dirname(target), { recursive: true });
    try {
      await access(target);
      return relativeKey;
    } catch {
      // The artifact does not exist yet.
    }
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, contents, { flag: 'wx' });
      await rename(temporary, target);
    } catch (error: unknown) {
      // A failed write/rename must not leave a partially written clinical export behind.
      await unlink(temporary).catch(() => undefined);
      throw error;
    }
    return relativeKey.replaceAll('\\', '/');
  }

  async read(storageKey: string): Promise<Uint8Array> {
    try {
      return new Uint8Array(await readFile(this.resolveKey(storageKey)));
    } catch (error: unknown) {
      if (this.isMissingFile(error))
        throw new ExportArtifactNotFoundError('El archivo de exportación no está disponible.');
      throw error;
    }
  }

  async delete(storageKey: string): Promise<void> {
    try {
      await unlink(this.resolveKey(storageKey));
    } catch (error: unknown) {
      if (!this.isMissingFile(error)) throw error;
    }
  }

  private resolveKey(storageKey: string): string {
    const match =
      /^([0-9a-f]{2})\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:\.attempt-[1-9][0-9]*)?\.(xlsx|pdf)$/i.exec(
        storageKey,
      );
    if (!match || !match[2]?.toLowerCase().startsWith(match[1]?.toLowerCase() ?? ''))
      throw new Error('INVALID_EXPORT_STORAGE_KEY');
    const target = resolve(this.root, storageKey);
    if (!target.startsWith(`${this.root}${sep}`)) throw new Error('INVALID_EXPORT_STORAGE_PATH');
    return target;
  }

  private isMissingFile(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'ENOENT'
    );
  }
}
