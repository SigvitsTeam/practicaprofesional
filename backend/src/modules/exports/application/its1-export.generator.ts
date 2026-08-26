import { Injectable } from '@nestjs/common';
import { ItsAttentionRepository } from '../../its-capture/application/ports/its-attention.repository';
import { RenderIts1PdfUseCase } from '../../its-capture/application/render-its1-pdf.use-case';
import type { Its1PrintRegister } from '../../its-capture/domain/its1-print-register';
import type { ClaimedExportJob } from '../domain/export-job';
import { loadOfficialWorkbook } from './official-form-workbook';

const ITS1_FIRST_DATA_ROW = 11;
const ITS1_TEMPLATE_ROWS = 25;
const ITS1_DISEASE_COUNT = 18;

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
    if (register.diseases.length > ITS1_DISEASE_COUNT)
      throw new Error('ITS1_OFFICIAL_TEMPLATE_DISEASE_LIMIT_EXCEEDED');
    const workbook = await loadOfficialWorkbook('formato-its1-oficial.xlsx');
    const sheet = workbook.getWorksheet('Registro ITS') ?? workbook.worksheets[0];
    if (!sheet) throw new Error('La plantilla ITS-1 no contiene una hoja de trabajo.');

    sheet.getCell('C5').value = this.safe(register.facility.regionName);
    sheet.getCell('I5').value = this.safe(register.facility.municipalityName);
    sheet.getCell('U5').value = this.safe(register.facility.name);
    sheet.getCell('AM5').value = this.safe(register.facility.code);
    sheet.getCell('C6').value = String(register.month).padStart(2, '0');
    sheet.getCell('G6').value = register.year;
    sheet.getCell('P6').value = this.safe(register.responsibleName);

    const requiredRows = Math.max(ITS1_TEMPLATE_ROWS, register.attentions.length);
    if (requiredRows > ITS1_TEMPLATE_ROWS)
      sheet.duplicateRow(
        ITS1_FIRST_DATA_ROW + ITS1_TEMPLATE_ROWS - 1,
        requiredRows - ITS1_TEMPLATE_ROWS,
        true,
      );

    const diseaseColumnById = new Map(
      [...register.diseases]
        .sort((left, right) => left.formatOrder - right.formatOrder)
        .slice(0, ITS1_DISEASE_COUNT)
        .map((disease, index) => [disease.id, 11 + index * 2]),
    );
    for (let index = 0; index < requiredRows; index += 1) {
      const rowNumber = ITS1_FIRST_DATA_ROW + index;
      const row = sheet.getRow(rowNumber);
      for (let column = 1; column <= 46; column += 1) row.getCell(column).value = null;
      const attention = register.attentions[index];
      if (!attention) continue;
      row.getCell(1).value = index + 1;
      row.getCell(2).value = this.safe(attention.originText);
      row.getCell(3).value = this.safe(attention.patientRecordNumber);
      row.getCell(attention.sex === 'H' ? 4 : 5).value = 'X';
      row.getCell(6).value = attention.age;
      row.getCell(attention.populationTypeCode === 'TRABAJADOR_SEXUAL' ? 8 : 7).value = 'X';
      if (attention.isContact) row.getCell(9).value = 'X';
      if (attention.isPregnant) row.getCell(10).value = 'X';
      for (const diagnosis of attention.diagnoses) {
        const baseColumn = diseaseColumnById.get(diagnosis.diseaseId);
        if (!baseColumn) continue;
        row.getCell(baseColumn + (diagnosis.caseType === 'CONTROL' ? 1 : 0)).value = 'X';
      }
    }

    const lastRow = ITS1_FIRST_DATA_ROW + requiredRows - 1;
    sheet.pageSetup.orientation = 'landscape';
    sheet.pageSetup.fitToPage = true;
    sheet.pageSetup.fitToWidth = 1;
    sheet.pageSetup.fitToHeight = 0;
    sheet.pageSetup.printTitlesRow = '1:10';
    sheet.pageSetup.printArea = `A1:AT${lastRow}`;
    for (
      let rowNumber = ITS1_FIRST_DATA_ROW + ITS1_TEMPLATE_ROWS - 1;
      rowNumber < lastRow;
      rowNumber += ITS1_TEMPLATE_ROWS
    )
      sheet.getRow(rowNumber).addPageBreak();
    await sheet.protect(job.id, {
      selectLockedCells: true,
      selectUnlockedCells: true,
      formatCells: false,
      insertRows: false,
      deleteRows: false,
      sort: false,
      autoFilter: false,
    });
    const buffer = await workbook.xlsx.writeBuffer();
    return new Uint8Array(buffer);
  }

  private safe(value: string): string {
    return /^[=+\-@]/.test(value) ? `'${value}` : value;
  }
}
