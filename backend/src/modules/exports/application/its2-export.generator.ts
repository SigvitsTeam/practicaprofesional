import { Injectable } from '@nestjs/common';
import { GetMonthlyReportUseCase } from '../../its-capture/application/get-monthly-report.use-case';
import { RenderIts2PdfUseCase } from '../../its-capture/application/render-its2-pdf.use-case';
import { RenderIts2XlsxUseCase } from '../../its-capture/application/render-its2-xlsx.use-case';
import type { ClaimedExportJob } from '../domain/export-job';

@Injectable()
export class Its2ExportGenerator {
  constructor(
    private readonly getMonthlyReport: GetMonthlyReportUseCase,
    private readonly renderPdf: RenderIts2PdfUseCase,
    private readonly renderXlsx: RenderIts2XlsxUseCase,
  ) {}

  async generate(job: ClaimedExportJob): Promise<Uint8Array> {
    if (job.reportType !== 'ITS2_MONTHLY') throw new Error('UNSUPPORTED_REPORT_TYPE');
    if (job.scopeLevel !== 'ESTABLECIMIENTO' || !job.territoryId)
      throw new Error('INVALID_ITS2_EXPORT_SCOPE');
    const report = await this.getMonthlyReport.execute(job.territoryId, job.year, job.month);
    return job.format === 'PDF'
      ? this.renderPdf.execute(report)
      : this.renderXlsx.execute(report, job.id);
  }
}
