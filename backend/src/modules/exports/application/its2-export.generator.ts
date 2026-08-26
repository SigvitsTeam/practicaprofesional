import { Injectable } from '@nestjs/common';
import { GetMonthlyReportUseCase } from '../../its-capture/application/get-monthly-report.use-case';
import { RenderIts2PdfUseCase } from '../../its-capture/application/render-its2-pdf.use-case';
import type { ItsMonthlyReport } from '../../its-capture/domain/its-monthly-report';
import type { ClaimedExportJob } from '../domain/export-job';
import { loadOfficialWorkbook } from './official-form-workbook';

const ITS2_FIRST_DATA_ROW = 14;
const ITS2_LAST_DATA_ROW = 31;

@Injectable()
export class Its2ExportGenerator {
  constructor(
    private readonly getMonthlyReport: GetMonthlyReportUseCase,
    private readonly renderPdf: RenderIts2PdfUseCase,
  ) {}

  async generate(job: ClaimedExportJob): Promise<Uint8Array> {
    if (job.reportType !== 'ITS2_MONTHLY') throw new Error('UNSUPPORTED_REPORT_TYPE');
    if (job.scopeLevel !== 'ESTABLECIMIENTO' || !job.territoryId)
      throw new Error('INVALID_ITS2_EXPORT_SCOPE');
    const report = await this.getMonthlyReport.execute(job.territoryId, job.year, job.month);
    return job.format === 'PDF' ? this.renderPdf.execute(report) : this.xlsx(job, report);
  }

  private async xlsx(job: ClaimedExportJob, report: ItsMonthlyReport): Promise<Uint8Array> {
    if (report.rows.length > ITS2_LAST_DATA_ROW - ITS2_FIRST_DATA_ROW + 1)
      throw new Error('ITS2_OFFICIAL_TEMPLATE_DISEASE_LIMIT_EXCEEDED');
    if (report.ageGroups.length > 9)
      throw new Error('ITS2_OFFICIAL_TEMPLATE_AGE_GROUP_LIMIT_EXCEEDED');
    const workbook = await loadOfficialWorkbook('formato-its2-oficial.xlsx');
    const sheet = workbook.getWorksheet('ITS 2') ?? workbook.worksheets[0];
    if (!sheet) throw new Error('La plantilla ITS-2 no contiene una hoja de trabajo.');

    sheet.getCell('D7').value = this.safe(report.facility.regionName);
    sheet.getCell('M7').value = this.safe(report.facility.municipalityName);
    sheet.getCell('AA7').value = this.safe(report.facility.name);
    sheet.getCell('C9').value = String(report.month).padStart(2, '0');
    sheet.getCell('K9').value = report.year;
    sheet.getCell('AA9').value = this.safe(report.facility.code);

    const ageGroups = [...report.ageGroups].sort(
      (left, right) => left.formatOrder - right.formatOrder,
    );
    const dataRows: number[][] = [];
    for (let index = 0; index <= ITS2_LAST_DATA_ROW - ITS2_FIRST_DATA_ROW; index += 1) {
      const rowNumber = ITS2_FIRST_DATA_ROW + index;
      const source = report.rows[index];
      if (source)
        sheet.getCell(rowNumber, 2).value = this.safe(
          `${String(index + 1).padStart(2, '0')}. ${source.diseaseName}`,
        );
      const values: number[] = source
        ? [
            source.diagnosis.newCases,
            source.diagnosis.controls,
            source.sex.male,
            source.sex.female,
            ...ageGroups.slice(0, 9).flatMap((ageGroup) => {
              const cell = source.ageGroups[ageGroup.code] ?? { male: 0, female: 0 };
              return [cell.male, cell.female];
            }),
            ...Array.from({ length: Math.max(0, 18 - ageGroups.slice(0, 9).length * 2) }, () => 0),
            source.population.generalMale.newCases,
            source.population.generalMale.controls,
            source.population.generalFemale.newCases,
            source.population.generalFemale.controls,
            source.population.generalPregnant.newCases,
            source.population.generalPregnant.controls,
            source.population.sexWorkerMale.newCases,
            source.population.sexWorkerMale.controls,
            source.population.sexWorkerFemale.newCases,
            source.population.sexWorkerFemale.controls,
            source.population.sexWorkerPregnant.newCases,
            source.population.sexWorkerPregnant.controls,
            source.population.contacts.male,
            source.population.contacts.female,
          ]
        : Array.from({ length: 36 }, () => 0);
      dataRows.push(values);
      for (let offset = 0; offset < 36; offset += 1)
        sheet.getCell(rowNumber, 3 + offset).value = values[offset] ?? 0;
    }

    for (let offset = 0; offset < 36; offset += 1) {
      const column = 3 + offset;
      const total = dataRows.reduce((sum, row) => sum + (row[offset] ?? 0), 0);
      const address = sheet.getCell(ITS2_FIRST_DATA_ROW, column).address.replace(/\d+$/, '');
      sheet.getCell(32, column).value = {
        formula: `SUM(${address}${ITS2_FIRST_DATA_ROW}:${address}${ITS2_LAST_DATA_ROW})`,
        result: total,
      };
    }
    sheet.pageSetup.orientation = 'landscape';
    sheet.pageSetup.fitToPage = true;
    sheet.pageSetup.fitToWidth = 1;
    sheet.pageSetup.fitToHeight = 1;
    sheet.pageSetup.printTitlesRow = '1:13';
    sheet.pageSetup.printArea = 'A1:AL32';
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
