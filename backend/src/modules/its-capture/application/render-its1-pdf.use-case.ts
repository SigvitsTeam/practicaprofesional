import { Injectable } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';
import type { Its1PrintRegister } from '../domain/its1-print-register';

const REFERENCE_WIDTH = 3508;
const REFERENCE_HEIGHT = 2480;
const ROWS_PER_PAGE = 28;

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

    header(register.facility.regionName, 1015, 490, 370);
    header(register.facility.municipalityName, 1455, 490, 570);
    header(register.facility.name, 2420, 490, 560);
    header(String(register.month).padStart(2, '0'), 1015, 600, 100);
    header(String(register.year), 1350, 600, 120);
    header(register.responsibleName, 2845, 600, 460);
    header(register.facility.code, 3210, 490, 160);

    const rowStartY = 1040;
    const rowHeight = 51.2;
    const diseaseStartX = 1358;
    const diseasePairWidth = 103.4;
    const caseOffset = 51.7;
    const rows = register.attentions.slice(
      pageIndex * ROWS_PER_PAGE,
      (pageIndex + 1) * ROWS_PER_PAGE,
    );
    const diseaseIndex = new Map(register.diseases.map((disease, index) => [disease.id, index]));
    rows.forEach((attention, rowIndex) => {
      const baselineY = rowStartY + rowIndex * rowHeight;
      draw(String(pageIndex * ROWS_PER_PAGE + rowIndex + 1), 324, baselineY);
      draw(attention.originText, 510, baselineY, 5, 235);
      draw(attention.patientRecordNumber, 760, baselineY, 5, 220);
      draw('X', attention.sex === 'H' ? 910 : 958, baselineY);
      draw(String(attention.age), 1032, baselineY);
      draw('X', attention.populationTypeCode === 'TRABAJADOR_SEXUAL' ? 1195 : 1125, baselineY);
      if (attention.isContact) draw('X', 1265, baselineY);
      if (attention.isPregnant) draw('X', 1315, baselineY);
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
