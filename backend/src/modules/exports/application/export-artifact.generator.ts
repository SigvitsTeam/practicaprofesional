import { Injectable } from '@nestjs/common';
import type { ClaimedExportJob } from '../domain/export-job';
import { ConsolidatedExportGenerator } from './consolidated-export.generator';
import { Its2ExportGenerator } from './its2-export.generator';
import { Its1ExportGenerator } from './its1-export.generator';
import { TerritorialExportGenerator } from './territorial-export.generator';
import { AnnualComparisonExportGenerator } from './annual-comparison-export.generator';

@Injectable()
export class ExportArtifactGenerator {
  constructor(
    private readonly territorial: TerritorialExportGenerator,
    private readonly its2: Its2ExportGenerator,
    private readonly consolidated: ConsolidatedExportGenerator,
    private readonly its1: Its1ExportGenerator,
    private readonly annualComparison: AnnualComparisonExportGenerator,
  ) {}

  generate(job: ClaimedExportJob): Promise<Uint8Array> {
    if (job.reportType === 'TERRITORIAL_SUMMARY') return this.territorial.generate(job);
    if (job.reportType === 'ITS2_MONTHLY') return this.its2.generate(job);
    if (job.reportType === 'ITS1_REGISTER') return this.its1.generate(job);
    if (job.reportType === 'ANNUAL_COMPARISON') return this.annualComparison.generate(job);
    if (
      ['MUNICIPAL_CONSOLIDATED', 'REGIONAL_CONSOLIDATED', 'NATIONAL_CONSOLIDATED'].includes(
        job.reportType,
      )
    )
      return this.consolidated.generate(job);
    throw new Error('UNSUPPORTED_REPORT_TYPE');
  }
}
