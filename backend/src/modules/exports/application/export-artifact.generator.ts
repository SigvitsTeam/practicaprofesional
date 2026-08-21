import { Injectable } from '@nestjs/common';
import type { ClaimedExportJob } from '../domain/export-job';
import { Its2ExportGenerator } from './its2-export.generator';
import { TerritorialExportGenerator } from './territorial-export.generator';

@Injectable()
export class ExportArtifactGenerator {
  constructor(
    private readonly territorial: TerritorialExportGenerator,
    private readonly its2: Its2ExportGenerator,
  ) {}

  generate(job: ClaimedExportJob): Promise<Uint8Array> {
    if (job.reportType === 'TERRITORIAL_SUMMARY') return this.territorial.generate(job);
    if (job.reportType === 'ITS2_MONTHLY') return this.its2.generate(job);
    throw new Error('UNSUPPORTED_REPORT_TYPE');
  }
}
