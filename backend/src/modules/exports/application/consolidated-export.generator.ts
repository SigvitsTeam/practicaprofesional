import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { MunicipalConsolidationRepository } from '../../its-capture/application/ports/municipal-consolidation.repository';
import { NationalConsolidationRepository } from '../../its-capture/application/ports/national-consolidation.repository';
import { RegionalConsolidationRepository } from '../../its-capture/application/ports/regional-consolidation.repository';
import type { ClaimedExportJob } from '../domain/export-job';

interface ConsolidatedSourceRow {
  code: string;
  name: string;
  version: number;
}

interface ConsolidatedDocument {
  title: string;
  territory: string;
  status: string;
  version: number;
  year: number;
  month: number;
  expectedSources: number;
  sourceAttentionCount: number;
  attentionTotalsComplete: boolean;
  attentionsUnder15?: number;
  attentions15Plus?: number;
  sources: readonly ConsolidatedSourceRow[];
}

@Injectable()
export class ConsolidatedExportGenerator {
  constructor(
    private readonly municipal: MunicipalConsolidationRepository,
    private readonly regional: RegionalConsolidationRepository,
    private readonly national: NationalConsolidationRepository,
  ) {}

  async generate(job: ClaimedExportJob): Promise<Uint8Array> {
    const document = await this.load(job);
    return job.format === 'XLSX' ? this.xlsx(document) : this.pdf(document);
  }

  private async load(job: ClaimedExportJob): Promise<ConsolidatedDocument> {
    if (job.reportType === 'MUNICIPAL_CONSOLIDATED') {
      if (job.scopeLevel !== 'MUNICIPIO' || !job.territoryId)
        throw new Error('INVALID_MUNICIPAL_EXPORT_SCOPE');
      const report = await this.municipal.getCurrent({
        municipalityId: job.territoryId,
        year: job.year,
        month: job.month,
      });
      if (!report) throw new Error('CONSOLIDATION_SOURCE_NOT_AVAILABLE');
      return {
        title: 'Consolidado municipal ITS-2',
        territory: `${report.municipality.code} · ${report.municipality.name}`,
        status: report.status,
        version: report.version,
        year: report.year,
        month: report.month,
        expectedSources: report.expectedFacilities,
        sourceAttentionCount: report.sourceAttentionCount,
        attentionTotalsComplete: report.attentionTotalsComplete,
        attentionsUnder15: report.attentionsUnder15,
        attentions15Plus: report.attentions15Plus,
        sources: report.sourceReports.map((source) => ({
          code: source.facility.code,
          name: source.facility.name,
          version: source.version,
        })),
      };
    }
    if (job.reportType === 'REGIONAL_CONSOLIDATED') {
      if (job.scopeLevel !== 'REGION' || !job.territoryId)
        throw new Error('INVALID_REGIONAL_EXPORT_SCOPE');
      const report = await this.regional.getCurrent({
        regionId: job.territoryId,
        year: job.year,
        month: job.month,
      });
      if (!report) throw new Error('CONSOLIDATION_SOURCE_NOT_AVAILABLE');
      return {
        title: 'Consolidado regional ITS-2',
        territory: `${report.region.code} · ${report.region.name}`,
        status: report.status,
        version: report.version,
        year: report.year,
        month: report.month,
        expectedSources: report.expectedMunicipalities,
        sourceAttentionCount: report.sourceAttentionCount,
        attentionTotalsComplete: report.attentionTotalsComplete,
        attentionsUnder15: report.attentionsUnder15,
        attentions15Plus: report.attentions15Plus,
        sources: report.sourceReports.map((source) => ({
          code: source.municipality.code,
          name: source.municipality.name,
          version: source.version,
        })),
      };
    }
    if (job.reportType === 'NATIONAL_CONSOLIDATED') {
      if (job.scopeLevel !== 'NACIONAL' || job.territoryId)
        throw new Error('INVALID_NATIONAL_EXPORT_SCOPE');
      const report = await this.national.getCurrent({ year: job.year, month: job.month });
      if (!report) throw new Error('CONSOLIDATION_SOURCE_NOT_AVAILABLE');
      return {
        title: 'Consolidado nacional ITS-2',
        territory: 'Honduras',
        status: report.status,
        version: report.version,
        year: report.year,
        month: report.month,
        expectedSources: report.expectedRegions,
        sourceAttentionCount: report.sourceAttentionCount,
        attentionTotalsComplete: report.attentionTotalsComplete,
        attentionsUnder15: report.attentionsUnder15,
        attentions15Plus: report.attentions15Plus,
        sources: report.sourceReports.map((source) => ({
          code: source.region.code,
          name: source.region.name,
          version: source.version,
        })),
      };
    }
    throw new Error('UNSUPPORTED_REPORT_TYPE');
  }

  private async xlsx(document: ConsolidatedDocument): Promise<Uint8Array> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SIGVITS';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Consolidado', {
      views: [{ state: 'frozen', ySplit: 9 }],
    });
    sheet.addRow([`SECRETARÍA DE SALUD · SIGVITS · ${document.title.toUpperCase()}`]);
    sheet.addRow([`Territorio: ${this.safe(document.territory)}`]);
    sheet.addRow([`Período: ${String(document.month).padStart(2, '0')}/${document.year}`]);
    sheet.addRow([`Estado: ${document.status} · Versión: ${document.version}`]);
    sheet.addRow([
      `Fuentes: ${document.sources.length}/${document.expectedSources} · Completitud: ${document.attentionTotalsComplete ? 'COMPLETA' : 'INCOMPLETA'}`,
    ]);
    sheet.addRow([`Atenciones fuente: ${document.sourceAttentionCount}`]);
    sheet.addRow([`Menores de 15: ${document.attentionsUnder15 ?? 'No disponible'}`]);
    sheet.addRow([`15 años o más: ${document.attentions15Plus ?? 'No disponible'}`]);
    sheet.addRow(['Código fuente', 'Territorio fuente', 'Versión incluida']);
    for (const source of document.sources)
      sheet.addRow([this.safe(source.code), this.safe(source.name), source.version]);
    for (let rowNumber = 1; rowNumber <= 8; rowNumber += 1)
      sheet.mergeCells(rowNumber, 1, rowNumber, 3);
    sheet.getRow(1).font = { bold: true, size: 14, color: { argb: 'FF0C5447' } };
    sheet.getRow(9).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0C6B5A' } };
    sheet.columns = [{ width: 22 }, { width: 48 }, { width: 20 }];
    sheet.autoFilter = { from: 'A9', to: `C${Math.max(9, document.sources.length + 9)}` };
    const buffer = await workbook.xlsx.writeBuffer();
    return new Uint8Array(buffer);
  }

  private async pdf(document: ConsolidatedDocument): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    let page = pdf.addPage([612, 792]);
    let y = 750;
    const header = (): void => {
      page.drawText(this.plain(document.title), {
        x: 36,
        y,
        size: 16,
        font: bold,
        color: rgb(0.05, 0.35, 0.29),
      });
      y -= 24;
      const details = [
        `Territorio: ${document.territory}`,
        `Periodo: ${String(document.month).padStart(2, '0')}/${document.year} | Estado: ${document.status} | Version: ${document.version}`,
        `Fuentes: ${document.sources.length}/${document.expectedSources} | Atenciones: ${document.sourceAttentionCount} | Totales: ${document.attentionTotalsComplete ? 'completos' : 'incompletos'}`,
      ];
      for (const detail of details) {
        page.drawText(this.plain(detail), { x: 36, y, size: 9, font: regular });
        y -= 16;
      }
      y -= 8;
      page.drawText('Codigo', { x: 36, y, size: 9, font: bold });
      page.drawText('Territorio fuente', { x: 140, y, size: 9, font: bold });
      page.drawText('Version', { x: 510, y, size: 9, font: bold });
      y -= 16;
    };
    header();
    for (const source of document.sources) {
      if (y < 42) {
        page = pdf.addPage([612, 792]);
        y = 750;
        header();
      }
      page.drawText(this.plain(source.code).slice(0, 18), { x: 36, y, size: 9, font: regular });
      page.drawText(this.plain(source.name).slice(0, 60), { x: 140, y, size: 9, font: regular });
      page.drawText(String(source.version), { x: 510, y, size: 9, font: regular });
      y -= 15;
    }
    return pdf.save();
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
