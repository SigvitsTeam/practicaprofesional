import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { TerritorialAnalyticsRepository } from '../../its-capture/application/ports/territorial-analytics.repository';
import type {
  TerritorialAnalyticsLevel,
  TerritorialAnalyticsRow,
  TerritorialAnalyticsScope,
} from '../../its-capture/domain/territorial-analytics';
import type { ClaimedExportJob } from '../domain/export-job';

@Injectable()
export class TerritorialExportGenerator {
  constructor(private readonly analytics: TerritorialAnalyticsRepository) {}

  async generate(job: ClaimedExportJob): Promise<Uint8Array> {
    if (job.reportType !== 'TERRITORIAL_SUMMARY') throw new Error('UNSUPPORTED_REPORT_TYPE');
    const level = this.level(job.scopeLevel);
    const rows = await this.analytics.list({
      level,
      year: job.year,
      month: job.month,
      scope: this.scope(job),
    });
    return job.format === 'XLSX' ? this.xlsx(job, level, rows) : this.pdf(job, level, rows);
  }

  private async xlsx(
    job: ClaimedExportJob,
    level: TerritorialAnalyticsLevel,
    rows: readonly TerritorialAnalyticsRow[],
  ): Promise<Uint8Array> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SIGVITS';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Resumen territorial', {
      views: [{ state: 'frozen', ySplit: 4 }],
    });
    sheet.addRow(['SIGVITS · Resumen territorial agregado']);
    sheet.addRow([`Período: ${String(job.month).padStart(2, '0')}/${job.year}`]);
    sheet.addRow([`Nivel: ${level}`]);
    sheet.addRow([
      'Código',
      'Territorio',
      'Estado ITS-2',
      'Atenciones',
      'Casos nuevos',
      'Controles',
      'Alertas',
    ]);
    for (const row of rows)
      sheet.addRow([
        this.safe(row.code),
        this.safe(row.name),
        this.safe(row.status),
        row.attentions,
        row.newCases,
        row.controls,
        row.alerts,
      ]);
    sheet.getRow(1).font = { bold: true, size: 14, color: { argb: 'FF0C5447' } };
    sheet.getRow(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0C6B5A' } };
    sheet.columns = [
      { width: 18 },
      { width: 34 },
      { width: 28 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 12 },
    ];
    sheet.autoFilter = { from: 'A4', to: `G${Math.max(4, rows.length + 4)}` };
    const buffer = await workbook.xlsx.writeBuffer();
    return new Uint8Array(buffer);
  }

  private async pdf(
    job: ClaimedExportJob,
    level: TerritorialAnalyticsLevel,
    rows: readonly TerritorialAnalyticsRow[],
  ): Promise<Uint8Array> {
    const document = await PDFDocument.create();
    const regular = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);
    const pageSize: [number, number] = [792, 612];
    let page = document.addPage(pageSize);
    let y = 575;
    const header = (): void => {
      page.drawText('SIGVITS - Resumen territorial agregado', {
        x: 36,
        y,
        size: 15,
        font: bold,
        color: rgb(0.05, 0.35, 0.29),
      });
      y -= 22;
      page.drawText(`Periodo ${String(job.month).padStart(2, '0')}/${job.year} | Nivel ${level}`, {
        x: 36,
        y,
        size: 9,
        font: regular,
      });
      y -= 24;
      page.drawText('Codigo', { x: 36, y, size: 8, font: bold });
      page.drawText('Territorio', { x: 110, y, size: 8, font: bold });
      page.drawText('Estado', { x: 330, y, size: 8, font: bold });
      page.drawText('Atenciones', { x: 490, y, size: 8, font: bold });
      page.drawText('Nuevos', { x: 555, y, size: 8, font: bold });
      page.drawText('Controles', { x: 615, y, size: 8, font: bold });
      page.drawText('Alertas', { x: 685, y, size: 8, font: bold });
      y -= 14;
    };
    header();
    for (const row of rows) {
      if (y < 36) {
        page = document.addPage(pageSize);
        y = 575;
        header();
      }
      page.drawText(this.plain(row.code).slice(0, 12), { x: 36, y, size: 8, font: regular });
      page.drawText(this.plain(row.name).slice(0, 38), { x: 110, y, size: 8, font: regular });
      page.drawText(this.plain(row.status).slice(0, 24), { x: 330, y, size: 8, font: regular });
      [row.attentions, row.newCases, row.controls, row.alerts].forEach((value, index) =>
        page.drawText(String(value), {
          x: [490, 555, 615, 685][index]!,
          y,
          size: 8,
          font: regular,
        }),
      );
      y -= 13;
    }
    return document.save();
  }

  private level(scopeLevel: ClaimedExportJob['scopeLevel']): TerritorialAnalyticsLevel {
    return scopeLevel === 'NACIONAL'
      ? 'REGION'
      : scopeLevel === 'REGION'
        ? 'MUNICIPIO'
        : 'ESTABLECIMIENTO';
  }

  private scope(job: ClaimedExportJob): TerritorialAnalyticsScope {
    return {
      national: job.scopeLevel === 'NACIONAL',
      regionIds: job.scopeLevel === 'REGION' && job.territoryId ? [job.territoryId] : [],
      municipalityIds: job.scopeLevel === 'MUNICIPIO' && job.territoryId ? [job.territoryId] : [],
      facilityIds: job.scopeLevel === 'ESTABLECIMIENTO' && job.territoryId ? [job.territoryId] : [],
    };
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
