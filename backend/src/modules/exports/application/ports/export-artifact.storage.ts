import type { ExportFormat, ExportJobClaim } from '../../domain/export-job';

export abstract class ExportArtifactStorage {
  abstract write(
    claim: ExportJobClaim,
    format: ExportFormat,
    contents: Uint8Array,
  ): Promise<string>;
  abstract read(storageKey: string): Promise<Uint8Array>;
  abstract delete(storageKey: string): Promise<void>;
}
