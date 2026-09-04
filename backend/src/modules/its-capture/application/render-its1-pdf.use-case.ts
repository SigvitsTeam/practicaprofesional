import { Injectable } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';
import type { Its1PrintRegister } from '../domain/its1-print-register';

const REFERENCE_WIDTH = 3508;
const REFERENCE_HEIGHT = 2480;
const ROWS_PER_PAGE = 25;

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

@Injectable()
export class RenderIts1PdfUseCase {
  async execute(register: Its1PrintRegister): Promise<Uint8Array> {
    const templateBytes = await readFile(templatePath('formato-its1-oficial.pdf'));
    const template = await PDFDocument.load(templateBytes);
    const document = await PDFDocument.create();
    const font = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);
    const pageCount = Math.max(1, Math.ceil(register.attentions.length / ROWS_PER_PAGE));

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      const page = (await document.copyPages(template, [0]))[0];
      if (!page) throw new Error('La plantilla ITS-1 no contiene una página imprimible.');
      document.addPage(page);
      this.fillPage(page, font, bold, register, pageIndex);
    }
    document.setTitle(
      `ITS-1 ${register.facility.code} ${register.year}-${String(register.month).padStart(2, '0')}`,
    );
    document.setAuthor('SIGVITS - Secretaría de Salud de Honduras');
    return document.save();
  }

  private fillPage(
    page: PDFPage,
    font: PDFFont,
    bold: PDFFont,
    register: Its1PrintRegister,
    pageIndex: number,
  ): void {
    const { width, height } = page.getSize();
    const x = (value: number): number => (value / REFERENCE_WIDTH) * width;
    const y = (value: number): number => height - (value / REFERENCE_HEIGHT) * height;
    const draw = (
      value: string,
      centerX: number,
      baselineY: number,
      size = 5.4,
      maxWidth?: number,
    ): void => {
      let finalSize = size;
      if (maxWidth)
        while (finalSize > 3.5 && font.widthOfTextAtSize(value, finalSize) > x(maxWidth))
          finalSize -= 0.2;
      page.drawText(value, {
        x: x(centerX) - font.widthOfTextAtSize(value, finalSize) / 2,
        y: y(baselineY),
        size: finalSize,
        font,
        color: rgb(0, 0, 0),
      });
    };
    const header = (value: string, startX: number, baselineY: number, maxWidth: number): void => {
      let size = 7;
      while (size > 4 && bold.widthOfTextAtSize(value, size) > x(maxWidth)) size -= 0.25;
      page.drawText(value, {
        x: x(startX),
        y: y(baselineY),
        size,
        font: bold,
        color: rgb(0, 0, 0),
      });
    };

    header(register.facility.regionName, 365, 360, 500);
    header(register.facility.municipalityName, 1136, 360, 520);
    header(register.facility.name, 1906, 360, 720);
    header(register.facility.code, 2882, 360, 400);
    header(String(register.month).padStart(2, '0'), 364, 432, 260);
    header(String(register.year), 898, 432, 200);
    header(register.responsibleName, 1634, 432, 1600);

    const rowStartY = 895;
    const rowHeight = 62;
    const diseaseStartX = 1376;
    const diseasePairWidth = 108.3;
    const caseOffset = 54.2;
    const rows = register.attentions.slice(
      pageIndex * ROWS_PER_PAGE,
      (pageIndex + 1) * ROWS_PER_PAGE,
    );
    const diseaseIndex = new Map(
      [...register.diseases]
        .sort((left, right) => left.formatOrder - right.formatOrder)
        .slice(0, 18)
        .map((disease, index) => [disease.id, index]),
    );
    rows.forEach((attention, rowIndex) => {
      const baselineY = rowStartY + rowIndex * rowHeight;
      draw(attention.originText, 228, baselineY, 5, 220);
      draw(attention.patientRecordNumber, 452, baselineY, 5, 200);
      draw('X', attention.sex === 'H' ? 618 : 738, baselineY);
      draw(String(attention.age), 840, baselineY);
      draw('X', attention.populationTypeCode === 'TRABAJADOR_SEXUAL' ? 1062 : 943, baselineY);
      if (attention.isContact) draw('X', 1173, baselineY);
      if (attention.isPregnant) draw('X', 1288, baselineY);
      attention.diagnoses.forEach((diagnosis) => {
        const index = diseaseIndex.get(diagnosis.diseaseId);
        if (index === undefined) return;
        draw(
          'X',
          diseaseStartX +
            index * diseasePairWidth +
            (diagnosis.caseType === 'CONTROL' ? caseOffset : 0),
          baselineY,
        );
      });
    });
  }
}
