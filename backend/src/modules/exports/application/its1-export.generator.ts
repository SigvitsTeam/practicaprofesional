import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { ItsAttentionRepository } from '../../its-capture/application/ports/its-attention.repository';
import { RenderIts1PdfUseCase } from '../../its-capture/application/render-its1-pdf.use-case';
import type { Its1PrintRegister } from '../../its-capture/domain/its1-print-register';
import type { ClaimedExportJob } from '../domain/export-job';

@Injectable()
export class Its1ExportGenerator {
  constructor(
    private readonly attentions: ItsAttentionRepository,
    private readonly renderPdf: RenderIts1PdfUseCase,
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
    return job.format === 'PDF' ? this.renderPdf.execute(register) : this.xlsx(job, register);
  }

  private async xlsx(job: ClaimedExportJob, register: Its1PrintRegister): Promise<Uint8Array> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SIGVITS';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('ITS-1', {
      views: [{ state: 'frozen', ySplit: 6 }],
    });
    sheet.addRow(['SECRETARÍA DE SALUD · SIGVITS · REGISTRO INDIVIDUAL ITS-1']);
    sheet.addRow([
      `Establecimiento: ${this.safe(register.facility.code)} · ${this.safe(register.facility.name)}`,
    ]);
    sheet.addRow([
      `Municipio: ${this.safe(register.facility.municipalityName)} · Región: ${this.safe(register.facility.regionName)}`,
    ]);
    sheet.addRow([`Período: ${String(register.month).padStart(2, '0')}/${register.year}`]);
    sheet.addRow([`Responsable de generación: ${this.safe(register.responsibleName)}`]);
    const headers = [
      'Procedencia',
      'Expediente',
      'Sexo',
      'Edad',
      'Población',
      'Contacto',
      'Embarazo',
      'Diagnósticos',
    ];
    sheet.addRow(headers);
    for (const attention of register.attentions) {
      sheet.addRow([
        this.safe(attention.originText),
        this.safe(attention.patientRecordNumber),
        attention.sex,
        attention.age,
        this.safe(attention.populationTypeCode),
        attention.isContact ? 'Sí' : 'No',
        attention.isPregnant ? 'Sí' : 'No',
        this.safe(
          attention.diagnoses
            .map(
              (diagnosis) =>
                `${diagnosis.diseaseCode ?? diagnosis.diseaseId} · ${diagnosis.diseaseName} · ${diagnosis.caseType}`,
            )
            .join(' | '),
        ),
      ]);
    }
    for (let rowNumber = 1; rowNumber <= 5; rowNumber += 1)
      sheet.mergeCells(rowNumber, 1, rowNumber, headers.length);
    sheet.getRow(1).font = { bold: true, size: 14, color: { argb: 'FF7A271A' } };
    sheet.getRow(6).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7A271A' } };
    sheet.columns = [
      { width: 28 },
      { width: 20 },
      { width: 10 },
      { width: 10 },
      { width: 22 },
      { width: 12 },
      { width: 12 },
      { width: 58 },
    ];
    sheet.autoFilter = { from: 'A6', to: `H${Math.max(6, register.attentions.length + 6)}` };
    await sheet.protect(job.id, {
      selectLockedCells: true,
      selectUnlockedCells: true,
      formatCells: false,
      insertRows: false,
      deleteRows: false,
      sort: false,
      autoFilter: true,
    });
    const buffer = await workbook.xlsx.writeBuffer();
    return new Uint8Array(buffer);
  }

  private safe(value: string): string {
    return /^[=+\-@]/.test(value) ? `'${value}` : value;
  }
}
