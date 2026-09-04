import { Injectable } from '@nestjs/common';
import { ItsAttentionRepository } from '../../its-capture/application/ports/its-attention.repository';
import { RenderIts1PdfUseCase } from '../../its-capture/application/render-its1-pdf.use-case';
import { RenderIts1XlsxUseCase } from '../../its-capture/application/render-its1-xlsx.use-case';
import type { ClaimedExportJob } from '../domain/export-job';

@Injectable()
export class Its1ExportGenerator {
  constructor(
    private readonly attentions: ItsAttentionRepository,
    private readonly renderPdf: RenderIts1PdfUseCase,
    private readonly renderXlsx: RenderIts1XlsxUseCase,
  ) {}

  async generate(job: ClaimedExportJob): Promise<Uint8Array> {
    if (job.reportType !== 'ITS1_REGISTER') throw new Error('UNSUPPORTED_REPORT_TYPE');
    if (job.scopeLevel !== 'ESTABLECIMIENTO' || !job.territoryId)
      throw new Error('INVALID_ITS1_EXPORT_SCOPE');
    const register = await this.attentions.getIts1PrintRegister({
      facilityId: job.territoryId,
      userId: job.requestedByUserId,
      year: job.year,
      month: job.month,
    });
    return job.format === 'PDF'
      ? this.renderPdf.execute(register)
      : this.renderXlsx.execute(register, job.id);
  }
}
