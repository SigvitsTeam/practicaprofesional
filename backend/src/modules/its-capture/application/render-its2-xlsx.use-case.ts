import { Injectable } from '@nestjs/common';
import type { ItsMonthlyReport } from '../domain/its-monthly-report';
import { loadOfficialWorkbook } from './official-form-workbook';
import type { Its2RenderOptions } from './its2-matrix-privacy.policy';

const ITS2_FIRST_DATA_ROW = 14;
const ITS2_LAST_DATA_ROW = 31;

@Injectable()
export class RenderIts2XlsxUseCase {
  async execute(
    report: ItsMonthlyReport,
    protectionKey = 'SIGVITS',
    options: Its2RenderOptions = {},
  ): Promise<Uint8Array> {
    if (report.rows.length > ITS2_LAST_DATA_ROW - ITS2_FIRST_DATA_ROW + 1)
      throw new Error('ITS2_OFFICIAL_TEMPLATE_DISEASE_LIMIT_EXCEEDED');
    if (report.ageGroups.length > 9)
      throw new Error('ITS2_OFFICIAL_TEMPLATE_AGE_GROUP_LIMIT_EXCEEDED');
    const workbook = await loadOfficialWorkbook('formato-its2-oficial.xlsx');
    const sheet = workbook.getWorksheet('ITS 2') ?? workbook.worksheets[0];
    if (!sheet) throw new Error('La plantilla ITS-2 no contiene una hoja de trabajo.');

    sheet.getCell('D7').value = this.safe(report.facility.regionName);
    sheet.getCell('M7').value = this.safe(report.facility.municipalityName);
    sheet.getCell('AA7').value = this.safe(
      options.preliminaryConsultation
        ? `${report.facility.name} · PRELIMINAR · CONSULTA`
        : report.facility.name,
    );
    sheet.getCell('C9').value = options.periodLabel ?? String(report.month).padStart(2, '0');
    sheet.getCell('K9').value = options.yearLabel ?? report.year;
    sheet.getCell('AA9').value = this.safe(report.facility.code);
    if (options.preliminaryConsultation) {
      sheet.getCell('A5').value = 'INFORME ITS 2 ACUMULADO · PRELIMINAR · CONSULTA (NO OFICIAL)';
      sheet.mergeCells('A6:AL6');
      sheet.getCell('A6').value = options.protection?.smallCountThreshold
        ? `PROTEGIDO: fila completa y totales ocultos cuando alguna celda positiva es menor a ${options.protection.smallCountThreshold}.`
        : 'Consulta acumulada preliminar; no corresponde a un cierre mensual oficial.';
      sheet.getCell('A6').font = { bold: true, size: 7, color: { argb: 'FF8A5A00' } };
      sheet.getCell('A6').alignment = { horizontal: 'center', vertical: 'middle' };
    }

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
      const protectedRow = options.protection?.protectedRowIndexes.includes(index) ?? false;
      for (let offset = 0; offset < 36; offset += 1) {
        const cell = sheet.getCell(rowNumber, 3 + offset);
        cell.value = protectedRow ? 'PROTEGIDO' : (values[offset] ?? 0);
        if (protectedRow) {
          cell.font = { ...cell.font, bold: true, size: 5, color: { argb: 'FF8A5A00' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
        }
      }
    }

    for (let offset = 0; offset < 36; offset += 1) {
      const column = 3 + offset;
      const total = dataRows.reduce((sum, row) => sum + (row[offset] ?? 0), 0);
      const address = sheet.getCell(ITS2_FIRST_DATA_ROW, column).address.replace(/\d+$/, '');
      const totalCell = sheet.getCell(32, column);
      totalCell.value = options.protection?.protectTotals
        ? 'PROTEGIDO'
        : {
            formula: `SUM(${address}${ITS2_FIRST_DATA_ROW}:${address}${ITS2_LAST_DATA_ROW})`,
            result: total,
          };
      if (options.protection?.protectTotals) {
        totalCell.font = {
          ...totalCell.font,
          bold: true,
          size: 5,
          color: { argb: 'FF8A5A00' },
        };
        totalCell.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
      }
    }
    sheet.pageSetup.orientation = 'landscape';
    sheet.pageSetup.fitToPage = true;
    sheet.pageSetup.fitToWidth = 1;
    sheet.pageSetup.fitToHeight = 1;
    sheet.pageSetup.printTitlesRow = '1:13';
    sheet.pageSetup.printArea = 'A1:AL32';
    await sheet.protect(protectionKey, {
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
