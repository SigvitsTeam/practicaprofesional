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
    join(process.cwd(), 'dist-worker', 'assets', 'forms', filename),
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

    text(report.facility.regionName, 648, 341, 7, 480, true);
    text(report.facility.municipalityName, 1394, 341, 7, 780, true);
    text(report.facility.name, 2514, 341, 7, 920, true);
    text(String(report.month).padStart(2, '0'), 542, 430, 8, 500, true);
    text(String(report.year), 1234, 430, 8, 250, true);
    text(report.facility.code, 2514, 430, 8, 920, true);

    const rowStartY = 706;
    const rowHeight = 46;
    const caseX: [number, number] = [526, 632];
    const sexX: [number, number] = [740, 820];
    const ageStartX = 900;
    const agePairWidth = 160;
    const ageSexOffset = 80;
    const populationStartX = 2340;
    const populationColumnWidth = 80;
    const ageGroups = [...report.ageGroups].sort(
      (left, right) => left.formatOrder - right.formatOrder,
    );

    report.rows.forEach((row, index) => {
      const y = rowStartY + index * rowHeight;
      centered(row.diagnosis.newCases, caseX[0], y, 106);
      centered(row.diagnosis.controls, caseX[1], y, 108);
      centered(row.sex.male, sexX[0], y, 80);
      centered(row.sex.female, sexX[1], y, 80);
      ageGroups.forEach((group, ageIndex) => {
        const cell = row.ageGroups[group.code];
        if (!cell) return;
        const x = ageStartX + ageIndex * agePairWidth;
        centered(cell.male, x, y, 80);
        centered(cell.female, x + ageSexOffset, y, 80);
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
        centered(value, populationStartX + columnIndex * populationColumnWidth, y, 80),
      );
      centered(row.population.contacts.male, 3300, y, 82);
      centered(row.population.contacts.female, 3382, y, 82);
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
    centered(diagnosis.newCases, caseX[0], totalY, 106);
    centered(diagnosis.controls, caseX[1], totalY, 108);
    centered(sex.male, sexX[0], totalY, 80);
    centered(sex.female, sexX[1], totalY, 80);
    ageGroups.forEach((group, ageIndex) => {
      const total = sumSex((row) => row.ageGroups[group.code] ?? { male: 0, female: 0 });
      const x = ageStartX + ageIndex * agePairWidth;
      centered(total.male, x, totalY, 80);
      centered(total.female, x + ageSexOffset, totalY, 80);
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
        centered(value, populationStartX + index * populationColumnWidth, totalY, 80),
      );
    const contacts = sumSex((row) => row.population.contacts);
    centered(contacts.male, 3300, totalY, 82);
    centered(contacts.female, 3382, totalY, 82);

    document.setTitle(
      `ITS-2 ${report.facility.code} ${report.year}-${String(report.month).padStart(2, '0')}`,
    );
    document.setAuthor('SIGVITS - Secretaría de Salud de Honduras');
    return document.save();
  }
}
