import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { GetMonthlyReportUseCase } from '../../its-capture/application/get-monthly-report.use-case';
import { RenderIts2PdfUseCase } from '../../its-capture/application/render-its2-pdf.use-case';
import type { ItsMonthlyReport } from '../../its-capture/domain/its-monthly-report';
import type { ClaimedExportJob } from '../domain/export-job';

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
    return job.format === 'PDF' ? this.renderPdf.execute(report) : this.xlsx(report);
  }

  private async xlsx(report: ItsMonthlyReport): Promise<Uint8Array> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SIGVITS';
    workbook.created = new Date();
    workbook.calcProperties.fullCalcOnLoad = true;
    const sheet = workbook.addWorksheet('ITS-2', {
      views: [{ state: 'frozen', ySplit: 6, xSplit: 3 }],
      properties: { defaultRowHeight: 18 },
    });
    sheet.addRow(['SECRETARÍA DE SALUD · SIGVITS · INFORME MENSUAL ITS-2']);
    sheet.addRow([
      `Establecimiento: ${this.safe(report.facility.code)} · ${this.safe(report.facility.name)}`,
    ]);
    sheet.addRow([
      `Municipio: ${this.safe(report.facility.municipalityName)} · Región: ${this.safe(report.facility.regionName)}`,
    ]);
    sheet.addRow([`Período: ${String(report.month).padStart(2, '0')}/${report.year}`]);
    sheet.addRow([`Total de atenciones: ${report.totalAttentions}`]);

    const headers = [
      'Código',
      'Clasificación',
      'Enfermedad',
      'Nuevos',
      'Controles',
      'Hombres',
      'Mujeres',
      ...report.ageGroups.flatMap((ageGroup) => [`${ageGroup.name} · H`, `${ageGroup.name} · M`]),
      'General H · Nuevos',
      'General H · Controles',
      'General M · Nuevos',
      'General M · Controles',
      'Embarazadas · Nuevos',
      'Embarazadas · Controles',
      'TS H · Nuevos',
      'TS H · Controles',
      'TS M · Nuevos',
      'TS M · Controles',
      'TS embarazadas · Nuevos',
      'TS embarazadas · Controles',
      'Contactos H',
      'Contactos M',
    ];
    sheet.addRow(headers);
    for (const row of report.rows) {
      sheet.addRow([
        this.safe(row.code ?? ''),
        this.safe(`${row.classificationCode} · ${row.classificationName}`),
        this.safe(row.diseaseName),
        row.diagnosis.newCases,
        row.diagnosis.controls,
        row.sex.male,
        row.sex.female,
        ...report.ageGroups.flatMap((ageGroup) => {
          const cell = row.ageGroups[ageGroup.code] ?? { male: 0, female: 0 };
          return [cell.male, cell.female];
        }),
        row.population.generalMale.newCases,
        row.population.generalMale.controls,
        row.population.generalFemale.newCases,
        row.population.generalFemale.controls,
        row.population.generalPregnant.newCases,
        row.population.generalPregnant.controls,
        row.population.sexWorkerMale.newCases,
        row.population.sexWorkerMale.controls,
        row.population.sexWorkerFemale.newCases,
        row.population.sexWorkerFemale.controls,
        row.population.sexWorkerPregnant.newCases,
        row.population.sexWorkerPregnant.controls,
        row.population.contacts.male,
        row.population.contacts.female,
      ]);
    }

    sheet.mergeCells(1, 1, 1, headers.length);
    for (let rowNumber = 2; rowNumber <= 5; rowNumber += 1)
      sheet.mergeCells(rowNumber, 1, rowNumber, headers.length);
    sheet.getRow(1).font = { bold: true, size: 15, color: { argb: 'FF0C5447' } };
    sheet.getRow(6).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0C6B5A' } };
    sheet.getRow(6).alignment = { vertical: 'middle', wrapText: true };
    sheet.getRow(6).height = 42;
    sheet.columns = headers.map((_, index) => ({
      width: index === 2 ? 32 : index === 1 ? 26 : 14,
    }));
    sheet.autoFilter = {
      from: { row: 6, column: 1 },
      to: { row: Math.max(6, report.rows.length + 6), column: headers.length },
    };
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber < 6) return;
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD9E2DF' } },
          left: { style: 'thin', color: { argb: 'FFD9E2DF' } },
          bottom: { style: 'thin', color: { argb: 'FFD9E2DF' } },
          right: { style: 'thin', color: { argb: 'FFD9E2DF' } },
        };
      });
    });
    const buffer = await workbook.xlsx.writeBuffer();
    return new Uint8Array(buffer);
  }

  private safe(value: string): string {
    return /^[=+\-@]/.test(value) ? `'${value}` : value;
  }
}
