import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { MunicipalPreliminaryReport } from '../domain/municipal-consolidation';

type PreliminaryMetric = 'attentions' | 'newCases' | 'controls' | 'alerts';

@Injectable()
export class RenderMunicipalPreliminaryUseCase {
  async xlsx(report: MunicipalPreliminaryReport): Promise<Uint8Array> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SIGVITS';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Preliminar ITS-1', {
      views: [{ state: 'frozen', ySplit: 8 }],
    });
    sheet.addRow(['SECRETARÍA DE SALUD · SIGVITS · RESUMEN MUNICIPAL PRELIMINAR ITS-1']);
    sheet.addRow([
      `Municipio: ${this.safe(report.municipality.code)} · ${this.safe(report.municipality.name)}`,
    ]);
    sheet.addRow([`Región: ${this.safe(report.municipality.regionName)}`]);
    sheet.addRow([`Período: ${String(report.month).padStart(2, '0')}/${report.year}`]);
    sheet.addRow(['Estado: PRELIMINAR ITS-1 · PENDIENTE DE DEPURACIÓN Y APROBACIÓN']);
    sheet.addRow([report.notice]);
    sheet.addRow([
      `Totales exactos · Atenciones: ${this.total(report, 'attentions')} · Casos nuevos: ${this.total(report, 'newCases')} · Controles: ${this.total(report, 'controls')} · Alertas: ${this.total(report, 'alerts')}`,
    ]);
    sheet.addRow([
      'Código',
      'Establecimiento',
      'Estado del flujo',
      'Atenciones',
      'Casos nuevos',
      'Controles',
      'Alertas',
    ]);
    for (const row of report.rows)
      sheet.addRow([
        this.safe(row.code),
        this.safe(row.name),
        this.safe(row.status),
        row.attentions,
        row.newCases,
        row.controls,
        row.alerts,
      ]);

    for (let rowNumber = 1; rowNumber <= 7; rowNumber += 1)
      sheet.mergeCells(rowNumber, 1, rowNumber, 7);
    sheet.getRow(1).font = { bold: true, size: 14, color: { argb: 'FF0C5447' } };
    sheet.getRow(5).font = { bold: true, color: { argb: 'FF8A5A00' } };
    sheet.getRow(6).font = { italic: true, color: { argb: 'FF6B5B2A' } };
    sheet.getRow(7).font = { bold: true };
    sheet.getRow(8).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(8).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0C6B5A' },
    };
    sheet.columns = [
      { width: 18 },
      { width: 38 },
      { width: 28 },
      { width: 14 },
      { width: 16 },
      { width: 14 },
      { width: 12 },
    ];
    sheet.autoFilter = { from: 'A8', to: `G${Math.max(8, report.rows.length + 8)}` };
    const buffer = await workbook.xlsx.writeBuffer();
    return new Uint8Array(buffer);
  }

  async pdf(report: MunicipalPreliminaryReport): Promise<Uint8Array> {
    const document = await PDFDocument.create();
    const regular = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);
    const pageSize: [number, number] = [792, 612];
    let page = document.addPage(pageSize);
    let y = 574;

    const header = (): void => {
      page.drawText('SIGVITS - RESUMEN MUNICIPAL PRELIMINAR ITS-1', {
        x: 34,
        y,
        size: 15,
        font: bold,
        color: rgb(0.05, 0.35, 0.29),
      });
      y -= 22;
      page.drawText(
        this.plain(
          `${report.municipality.code} - ${report.municipality.name} | ${report.municipality.regionName} | ${String(report.month).padStart(2, '0')}/${report.year}`,
        ).slice(0, 112),
        { x: 34, y, size: 9, font: regular },
      );
      y -= 18;
      page.drawText('DATOS PRELIMINARES ITS-1 - PENDIENTES DE DEPURACION Y APROBACION', {
        x: 34,
        y,
        size: 9,
        font: bold,
        color: rgb(0.55, 0.35, 0),
      });
      y -= 17;
      page.drawText(
        this.plain(
          `Totales exactos | Atenciones: ${this.total(report, 'attentions')} | Nuevos: ${this.total(report, 'newCases')} | Controles: ${this.total(report, 'controls')} | Alertas: ${this.total(report, 'alerts')}`,
        ),
        { x: 34, y, size: 8, font: bold },
      );
      y -= 22;
      page.drawText('Codigo', { x: 34, y, size: 8, font: bold });
      page.drawText('Establecimiento', { x: 105, y, size: 8, font: bold });
      page.drawText('Estado', { x: 335, y, size: 8, font: bold });
      page.drawText('Atenciones', { x: 490, y, size: 8, font: bold });
      page.drawText('Nuevos', { x: 555, y, size: 8, font: bold });
      page.drawText('Controles', { x: 615, y, size: 8, font: bold });
      page.drawText('Alertas', { x: 684, y, size: 8, font: bold });
      y -= 14;
    };

    header();
    for (const row of report.rows) {
      if (y < 38) {
        page = document.addPage(pageSize);
        y = 574;
        header();
      }
      page.drawText(this.plain(row.code).slice(0, 11), { x: 34, y, size: 8, font: regular });
      page.drawText(this.plain(row.name).slice(0, 38), { x: 105, y, size: 8, font: regular });
      page.drawText(this.plain(row.status).slice(0, 23), { x: 335, y, size: 8, font: regular });
      [row.attentions, row.newCases, row.controls, row.alerts].forEach((value, index) =>
        page.drawText(String(value), {
          x: [490, 555, 615, 684][index]!,
          y,
          size: 8,
          font: regular,
        }),
      );
      y -= 13;
    }

    document.setTitle(
      `Preliminar ITS-1 municipal ${report.municipality.code} ${report.year}-${String(report.month).padStart(2, '0')}`,
    );
    document.setAuthor('SIGVITS - Secretaría de Salud de Honduras');
    document.setSubject('Datos preliminares pendientes de depuración y aprobación');
    return document.save();
  }

  private total(report: MunicipalPreliminaryReport, metric: PreliminaryMetric): number {
    return report.rows.reduce((sum, row) => sum + row[metric], 0);
  }

  private safe(value: string): string {
    return /^[=+\-@]/.test(value) ? `'${value}` : value;
  }

  private plain(value: string): string {
    return [...value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')]
      .map((character) => {
        const code = character.codePointAt(0) ?? 0;
        return code >= 32 && code <= 126 ? character : '?';
      })
      .join('');
  }
}
