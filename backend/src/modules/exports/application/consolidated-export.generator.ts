import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { MunicipalConsolidationRepository } from '../../its-capture/application/ports/municipal-consolidation.repository';
import { NationalConsolidationRepository } from '../../its-capture/application/ports/national-consolidation.repository';
import { RegionalConsolidationRepository } from '../../its-capture/application/ports/regional-consolidation.repository';
import { TerritorialAnalyticsRepository } from '../../its-capture/application/ports/territorial-analytics.repository';
import { TerritorialAnalyticsPrivacyPolicy } from '../../its-capture/application/territorial-analytics-privacy.policy';
import type {
  TerritorialAnalyticsLevel,
  TerritorialAnalyticsPublicRow,
} from '../../its-capture/domain/territorial-analytics';
import type { ClaimedExportJob } from '../domain/export-job';

interface ConsolidatedSourceRow {
  code: string;
  name: string;
  version?: number;
  status: string;
  attentions?: number;
  newCases?: number;
  controls?: number;
}

interface ConsolidatedDocument {
  title: string;
  territory: string;
  status: string;
  version?: number;
  preliminary: boolean;
  year: number;
  month: number;
  expectedSources: number;
  sourceAttentionCount: number;
  newCases?: number;
  controls?: number;
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
    private readonly analytics: TerritorialAnalyticsRepository,
    private readonly privacy: TerritorialAnalyticsPrivacyPolicy,
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
      if (!report || report.status !== 'APROBADO_REGION')
        return this.preliminary(
          job,
          'ESTABLECIMIENTO',
          report
            ? `${report.municipality.code} · ${report.municipality.name}`
            : 'Municipio autorizado',
          { municipalityId: job.territoryId },
        );
      return {
        title: 'Consolidado municipal ITS-2',
        territory: `${report.municipality.code} · ${report.municipality.name}`,
        status: report.status,
        version: report.version,
        preliminary: false,
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
          status: 'APROBADO_MUNICIPIO',
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
      if (!report || report.status !== 'APROBADO_CENTRAL')
        return this.preliminary(
          job,
          'MUNICIPIO',
          report ? `${report.region.code} · ${report.region.name}` : 'Región autorizada',
          { regionId: job.territoryId },
        );
      return {
        title: 'Consolidado regional ITS-2',
        territory: `${report.region.code} · ${report.region.name}`,
        status: report.status,
        version: report.version,
        preliminary: false,
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
          status: 'APROBADO_REGION',
        })),
      };
    }
    if (job.reportType === 'NATIONAL_CONSOLIDATED') {
      if (job.scopeLevel !== 'NACIONAL' || job.territoryId)
        throw new Error('INVALID_NATIONAL_EXPORT_SCOPE');
      const report = await this.national.getCurrent({ year: job.year, month: job.month });
      if (!report || report.status !== 'CERRADO_OFICIAL')
        return this.preliminary(job, 'REGION', 'Honduras');
      return {
        title: 'Consolidado nacional ITS-2',
        territory: 'Honduras',
        status: report.status,
        version: report.version,
        preliminary: false,
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
          status: 'APROBADO_CENTRAL',
        })),
      };
    }
    throw new Error('UNSUPPORTED_REPORT_TYPE');
  }

  private async preliminary(
    job: ClaimedExportJob,
    level: TerritorialAnalyticsLevel,
    territory: string,
    parent: { regionId?: string; municipalityId?: string } = {},
  ): Promise<ConsolidatedDocument> {
    const rows = await this.analytics.list({
      level,
      year: job.year,
      month: job.month,
      ...parent,
      // The job's territory was authorized when it was created. The explicit parent
      // limits this internal read to that scope while allowing its descendants.
      scope: { national: true, regionIds: [], municipalityIds: [], facilityIds: [] },
    });
    const publicRows = this.privacy.protect(rows).rows;
    const labels: Record<TerritorialAnalyticsLevel, string> = {
      ESTABLECIMIENTO: 'Resumen preliminar municipal ITS',
      MUNICIPIO: 'Resumen preliminar regional ITS',
      REGION: 'Resumen preliminar nacional ITS',
    };
    return {
      title: labels[level],
      territory,
      status: 'PRELIMINAR · PENDIENTE DE APROBACIÓN',
      preliminary: true,
      year: job.year,
      month: job.month,
      expectedSources: rows.length,
      sourceAttentionCount: this.sum(publicRows, 'attentions'),
      newCases: this.sum(publicRows, 'newCases'),
      controls: this.sum(publicRows, 'controls'),
      attentionTotalsComplete: true,
      sources: publicRows.map((row) => ({
        code: row.code,
        name: row.name,
        version: row.reportVersion,
        status: row.status === 'SIN_REPORTE' ? 'ITS 2 PENDIENTE' : row.status,
        attentions: row.attentions,
        newCases: row.newCases,
        controls: row.controls,
      })),
    };
  }

  private sum(
    rows: readonly TerritorialAnalyticsPublicRow[],
    metric: 'attentions' | 'newCases' | 'controls',
  ): number {
    return rows.reduce((total, row) => total + row[metric], 0);
  }

  private async xlsx(document: ConsolidatedDocument): Promise<Uint8Array> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SIGVITS';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Consolidado', {
      views: [{ state: 'frozen', ySplit: 10 }],
    });
    sheet.addRow([`SECRETARÍA DE SALUD · SIGVITS · ${document.title.toUpperCase()}`]);
    sheet.addRow([`Territorio: ${this.safe(document.territory)}`]);
    sheet.addRow([`Período: ${String(document.month).padStart(2, '0')}/${document.year}`]);
    sheet.addRow([`Estado: ${document.status} · Versión: ${document.version ?? 'No aplica'}`]);
    sheet.addRow([
      document.preliminary
        ? 'AVISO: datos preliminares acumulados automáticamente desde ITS 1; pendientes de depuración y aprobación institucional.'
        : 'Datos aprobados conforme al flujo institucional del nivel correspondiente.',
    ]);
    sheet.addRow([
      `Fuentes visibles: ${document.sources.length}/${document.expectedSources} · Corte generado: ${new Date().toISOString()}`,
    ]);
    sheet.addRow([
      `Atenciones: ${this.metric(document.sourceAttentionCount)} · Casos nuevos: ${this.metric(document.newCases)} · Controles: ${this.metric(document.controls)}`,
    ]);
    sheet.addRow([`Menores de 15: ${document.attentionsUnder15 ?? 'No disponible'}`]);
    sheet.addRow([`15 años o más: ${document.attentions15Plus ?? 'No disponible'}`]);
    sheet.addRow([
      'Código fuente',
      'Territorio fuente',
      'Versión ITS 2',
      'Estado de aprobación',
      'Atenciones ITS 1',
      'Casos nuevos',
      'Controles',
    ]);
    for (const source of document.sources)
      sheet.addRow([
        this.safe(source.code),
        this.safe(source.name),
        source.version ?? 'Pendiente',
        this.safe(source.status),
        this.metric(source.attentions, '—'),
        this.metric(source.newCases, '—'),
        this.metric(source.controls, '—'),
      ]);
    for (let rowNumber = 1; rowNumber <= 9; rowNumber += 1)
      sheet.mergeCells(rowNumber, 1, rowNumber, 7);
    sheet.getRow(1).font = { bold: true, size: 14, color: { argb: 'FF0C5447' } };
    sheet.getRow(5).font = {
      bold: document.preliminary,
      color: { argb: document.preliminary ? 'FF8A5A00' : 'FF0C5447' },
    };
    sheet.getRow(10).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0C6B5A' } };
    sheet.columns = [
      { width: 20 },
      { width: 38 },
      { width: 18 },
      { width: 30 },
      { width: 18 },
      { width: 16 },
      { width: 14 },
    ];
    sheet.autoFilter = { from: 'A10', to: `G${Math.max(10, document.sources.length + 10)}` };
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
        `Periodo: ${String(document.month).padStart(2, '0')}/${document.year} | Estado: ${document.status} | Version: ${document.version ?? 'No aplica'}`,
        document.preliminary
          ? 'DATOS PRELIMINARES DESDE ITS 1 - PENDIENTES DE DEPURACION Y APROBACION'
          : 'DATOS APROBADOS CONFORME AL FLUJO INSTITUCIONAL',
        `Fuentes: ${document.sources.length}/${document.expectedSources} | Atenciones: ${this.metric(document.sourceAttentionCount, 'N/D')} | Nuevos: ${this.metric(document.newCases, 'N/D')} | Controles: ${this.metric(document.controls, 'N/D')}`,
      ];
      for (const [index, detail] of details.entries()) {
        page.drawText(this.plain(detail), {
          x: 36,
          y,
          size: index === 2 ? 8 : 9,
          font: index === 2 ? bold : regular,
          color: index === 2 && document.preliminary ? rgb(0.55, 0.35, 0) : rgb(0, 0, 0),
        });
        y -= 16;
      }
      y -= 8;
      page.drawText('Codigo', { x: 36, y, size: 9, font: bold });
      page.drawText('Territorio fuente', { x: 100, y, size: 9, font: bold });
      page.drawText('Estado', { x: 300, y, size: 9, font: bold });
      page.drawText('Aten.', { x: 478, y, size: 9, font: bold });
      page.drawText('Nuevos', { x: 520, y, size: 9, font: bold });
      page.drawText('Ctrl.', { x: 570, y, size: 9, font: bold });
      y -= 16;
    };
    header();
    for (const source of document.sources) {
      if (y < 42) {
        page = pdf.addPage([612, 792]);
        y = 750;
        header();
      }
      page.drawText(this.plain(source.code).slice(0, 10), { x: 36, y, size: 8, font: regular });
      page.drawText(this.plain(source.name).slice(0, 31), { x: 100, y, size: 8, font: regular });
      page.drawText(
        this.plain(`${source.status}${source.version ? ` v${source.version}` : ''}`).slice(0, 27),
        { x: 300, y, size: 8, font: regular },
      );
      page.drawText(String(this.metric(source.attentions, '-')), {
        x: 478,
        y,
        size: 8,
        font: regular,
      });
      page.drawText(String(this.metric(source.newCases, '-')), {
        x: 530,
        y,
        size: 8,
        font: regular,
      });
      page.drawText(String(this.metric(source.controls, '-')), {
        x: 575,
        y,
        size: 8,
        font: regular,
      });
      y -= 15;
    }
    return pdf.save();
  }

  private safe(value: string): string {
    return /^[=+\-@]/.test(value) ? `'${value}` : value;
  }

  private metric(value: number | undefined, unavailable = 'No disponible'): number | string {
    return value ?? unavailable;
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
