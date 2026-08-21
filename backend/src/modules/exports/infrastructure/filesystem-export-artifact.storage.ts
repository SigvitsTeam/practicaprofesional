import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { access, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { exportConfig } from '../../../config/app.config';
import { ExportArtifactStorage } from '../application/ports/export-artifact.storage';
import type { ExportFormat } from '../domain/export-job';

@Injectable()
export class FilesystemExportArtifactStorage extends ExportArtifactStorage {
  private readonly root: string;

  constructor(@Inject(exportConfig.KEY) config: ConfigType<typeof exportConfig>) {
    super();
    this.root = resolve(config.storageDirectory);
  }

  async write(jobId: string, format: ExportFormat, contents: Uint8Array): Promise<string> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId))
      throw new Error('INVALID_EXPORT_JOB_ID');
    const extension = format.toLowerCase();
    const relativeKey = `${jobId.slice(0, 2)}/${jobId}.${extension}`;
    const target = this.resolveKey(relativeKey);
    await mkdir(dirname(target), { recursive: true });
    try {
      await access(target);
      return relativeKey;
    } catch {
      // The artifact does not exist yet.
    }
    const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporary, contents, { flag: 'wx' });
    try {
      await rename(temporary, target);
    } catch (error: unknown) {
      try {
        await access(target);
        await unlink(temporary);
      } catch {
        throw error;
      }
    }
    return relativeKey.replaceAll('\\', '/');
  }

  async read(storageKey: string): Promise<Uint8Array> {
    return new Uint8Array(await readFile(this.resolveKey(storageKey)));
  }

  private resolveKey(storageKey: string): string {
    const match =
      /^([0-9a-f]{2})\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(xlsx|pdf)$/i.exec(
        storageKey,
      );
    if (!match || !match[2]?.toLowerCase().startsWith(match[1]?.toLowerCase() ?? ''))
      throw new Error('INVALID_EXPORT_STORAGE_KEY');
    const target = resolve(this.root, storageKey);
    if (!target.startsWith(`${this.root}${sep}`)) throw new Error('INVALID_EXPORT_STORAGE_PATH');
    return target;
  }
}
