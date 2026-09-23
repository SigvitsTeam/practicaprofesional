import { Injectable } from '@nestjs/common';
import { RenderIts2PdfUseCase } from '../../its-capture/application/render-its2-pdf.use-case';
import { RenderIts2XlsxUseCase } from '../../its-capture/application/render-its2-xlsx.use-case';
import { buildItsMonthlyReport } from '../../its-capture/domain/its-monthly-report';
import type { ClaimedExportJob, MunicipalConsolidatedExportParameters } from '../domain/export-job';
import { MunicipalIts2ExportRepository } from './ports/municipal-its2-export.repository';

@Injectable()
export class MunicipalIts2ExportGenerator {
  constructor(
    private readonly repository: MunicipalIts2ExportRepository,
    private readonly renderPdf: RenderIts2PdfUseCase,
    private readonly renderXlsx: RenderIts2XlsxUseCase,
  ) {}

  async generate(job: ClaimedExportJob): Promise<Uint8Array> {
    if (job.reportType !== 'MUNICIPAL_CONSOLIDATED') throw new Error('UNSUPPORTED_REPORT_TYPE');
    if (job.scopeLevel !== 'MUNICIPIO' || !job.territoryId)
      throw new Error('INVALID_MUNICIPAL_EXPORT_SCOPE');
    const range = await this.repository.resolveRange(this.parameters(job));
    const source = await this.repository.getReportSource({
      municipalityId: job.territoryId,
      range,
    });
    const report = buildItsMonthlyReport(source, range.anchorYear, range.anchorMonth);
    const options = {
      periodLabel: range.periodLabel,
      yearLabel: range.yearLabel,
      preliminaryConsultation: true,
    };
    return job.format === 'PDF'
      ? this.renderPdf.execute(report, options)
      : this.renderXlsx.execute(report, job.id, options);
  }

  private parameters(job: ClaimedExportJob): MunicipalConsolidatedExportParameters {
    if (!job.parameters)
      return {
        timeUnit: 'MONTH',
        startPeriod: `${job.year}-${String(job.month).padStart(2, '0')}`,
        endPeriod: `${job.year}-${String(job.month).padStart(2, '0')}`,
      };
    const { timeUnit, startPeriod, endPeriod } = job.parameters;
    if (
      (timeUnit !== 'MONTH' && timeUnit !== 'EPIDEMIOLOGICAL_WEEK') ||
      typeof startPeriod !== 'string' ||
      typeof endPeriod !== 'string'
    )
      throw new Error('INVALID_MUNICIPAL_EXPORT_PARAMETERS');
    return { timeUnit, startPeriod, endPeriod };
  }
}
