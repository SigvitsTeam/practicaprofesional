import { Injectable } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type {
  ItsMonthlyReport,
  MonthlyReportCaseCell,
  MonthlyReportCell,
} from '../domain/its-monthly-report';

const REFERENCE_WIDTH = 3508;
const REFERENCE_HEIGHT = 2480;

function templatePath(filename: string): string {
  const candidates = [
    join(process.cwd(), 'src', 'assets', 'forms', filename),
    join(process.cwd(), 'dist', 'assets', 'forms', filename),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error(`No se encontró la plantilla oficial ${filename}.`);
  return found;
}

function pxX(value: number, pageWidth: number): number {
  return (value / REFERENCE_WIDTH) * pageWidth;
}

function pxY(value: number, pageHeight: number): number {
  return pageHeight - (value / REFERENCE_HEIGHT) * pageHeight;
}

@Injectable()
export class RenderIts2PdfUseCase {
  async execute(report: ItsMonthlyReport): Promise<Uint8Array> {
    const template = await readFile(templatePath('formato-its2-oficial.pdf'));
    const document = await PDFDocument.load(template);
    const page = document.getPage(0);
    const font = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);
    const { width, height } = page.getSize();

    const text = (
      value: string,
      x: number,
      y: number,
      size = 7,
      maxWidth?: number,
      useBold = false,
    ): void => {
      const selectedFont = useBold ? bold : font;
      let finalSize = size;
      if (maxWidth)
        while (
          finalSize > 4 &&
          selectedFont.widthOfTextAtSize(value, finalSize) > pxX(maxWidth, width)
        )
          finalSize -= 0.25;
      page.drawText(value, {
        x: pxX(x, width),
        y: pxY(y, height),
        size: finalSize,
        font: selectedFont,
        color: rgb(0, 0, 0),
      });
    };
    const centered = (value: number, x: number, y: number, cellWidth: number): void => {
      if (value === 0) return;
      const label = String(value);
      const size = 5.4;
      const labelWidth = font.widthOfTextAtSize(label, size);
      page.drawText(label, {
        x: pxX(x, width) + (pxX(cellWidth, width) - labelWidth) / 2,
        y: pxY(y, height),
        size,
        font,
        color: rgb(0, 0, 0),
      });
    };

    text(report.facility.regionName, 825, 550, 7, 350, true);
    text(report.facility.municipalityName, 1430, 550, 7, 620, true);
    text(report.facility.name, 2585, 550, 7, 650, true);
    text(String(report.month).padStart(2, '0'), 840, 635, 8, 160, true);
    text(String(report.year), 1235, 635, 8, 130, true);
    text(report.facility.code, 2630, 635, 8, 500, true);

    const rowStartY = 930;
    const rowHeight = 77.5;
    const caseX: [number, number] = [820, 900];
    const sexX: [number, number] = [993, 1064];
    const ageStartX = 1133;
    const agePairWidth = 145;
    const ageSexOffset = 72.5;
    const populationStartX = 2433;
    const populationColumnWidth = 74;

    report.rows.forEach((row, index) => {
      const y = rowStartY + index * rowHeight;
      centered(row.diagnosis.newCases, caseX[0], y, 80);
      centered(row.diagnosis.controls, caseX[1], y, 90);
      centered(row.sex.male, sexX[0], y, 70);
      centered(row.sex.female, sexX[1], y, 70);
      report.ageGroups.forEach((group, ageIndex) => {
        const cell = row.ageGroups[group.code];
        if (!cell) return;
        const x = ageStartX + ageIndex * agePairWidth;
        centered(cell.male, x, y, 67);
        centered(cell.female, x + ageSexOffset, y, 67);
      });
      const populationValues = [
        row.population.generalMale,
        row.population.generalFemale,
        row.population.generalPregnant,
        row.population.sexWorkerMale,
        row.population.sexWorkerFemale,
        row.population.sexWorkerPregnant,
      ].flatMap((cell: MonthlyReportCaseCell) => [cell.newCases, cell.controls]);
      populationValues.forEach((value, columnIndex) =>
        centered(value, populationStartX + columnIndex * populationColumnWidth, y, 70),
      );
      centered(row.population.contacts.male, 3322, y, 56);
      centered(row.population.contacts.female, 3378, y, 56);
    });

    const sumCase = (
      selector: (row: ItsMonthlyReport['rows'][number]) => MonthlyReportCaseCell,
    ): MonthlyReportCaseCell => ({
      newCases: report.rows.reduce((sum, row) => sum + selector(row).newCases, 0),
      controls: report.rows.reduce((sum, row) => sum + selector(row).controls, 0),
    });
    const sumSex = (
      selector: (row: ItsMonthlyReport['rows'][number]) => MonthlyReportCell,
    ): MonthlyReportCell => ({
      male: report.rows.reduce((sum, row) => sum + selector(row).male, 0),
      female: report.rows.reduce((sum, row) => sum + selector(row).female, 0),
    });
    const totalY = rowStartY + 18 * rowHeight;
    const diagnosis = sumCase((row) => row.diagnosis);
    const sex = sumSex((row) => row.sex);
    centered(diagnosis.newCases, caseX[0], totalY, 80);
    centered(diagnosis.controls, caseX[1], totalY, 90);
    centered(sex.male, sexX[0], totalY, 70);
    centered(sex.female, sexX[1], totalY, 70);
    report.ageGroups.forEach((group, ageIndex) => {
      const total = sumSex((row) => row.ageGroups[group.code] ?? { male: 0, female: 0 });
      const x = ageStartX + ageIndex * agePairWidth;
      centered(total.male, x, totalY, 67);
      centered(total.female, x + ageSexOffset, totalY, 67);
    });
    const populationSelectors = [
      (row: ItsMonthlyReport['rows'][number]): MonthlyReportCaseCell => row.population.generalMale,
      (row: ItsMonthlyReport['rows'][number]): MonthlyReportCaseCell =>
        row.population.generalFemale,
      (row: ItsMonthlyReport['rows'][number]): MonthlyReportCaseCell =>
        row.population.generalPregnant,
      (row: ItsMonthlyReport['rows'][number]): MonthlyReportCaseCell =>
        row.population.sexWorkerMale,
      (row: ItsMonthlyReport['rows'][number]): MonthlyReportCaseCell =>
        row.population.sexWorkerFemale,
      (row: ItsMonthlyReport['rows'][number]): MonthlyReportCaseCell =>
        row.population.sexWorkerPregnant,
    ];
    populationSelectors
      .flatMap(sumCase)
      .flatMap((cell) => [cell.newCases, cell.controls])
      .forEach((value, index) =>
        centered(value, populationStartX + index * populationColumnWidth, totalY, 70),
      );
    const contacts = sumSex((row) => row.population.contacts);
    centered(contacts.male, 3322, totalY, 56);
    centered(contacts.female, 3378, totalY, 56);

    document.setTitle(
      `ITS-2 ${report.facility.code} ${report.year}-${String(report.month).padStart(2, '0')}`,
    );
    document.setAuthor('SIGVITS - Secretaría de Salud de Honduras');
    return document.save();
  }
}
