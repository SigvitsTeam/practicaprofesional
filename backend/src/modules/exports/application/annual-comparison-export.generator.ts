import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { TerritorialAnalyticsRepository } from '../../its-capture/application/ports/territorial-analytics.repository';
import { TerritorialAnalyticsPrivacyPolicy } from '../../its-capture/application/territorial-analytics-privacy.policy';
import type {
  TerritorialAnalyticsLevel,
  TerritorialAnalyticsPublicRow,
  TerritorialAnalyticsScope,
} from '../../its-capture/domain/territorial-analytics';
import type {
  AnnualComparisonIndicator,
  AnnualComparisonParameters,
  ClaimedExportJob,
} from '../domain/export-job';

interface MonthlyAggregate {
  series: 'A' | 'B';
  period: string;
  attentions: number | null;
  newCases: number | null;
  controls: number | null;
  totalCases: number | null;
  alerts: number | null;
  ratePer1000: number | null;
  dataStatus: 'PRELIMINAR' | 'OFICIAL';
}

@Injectable()
export class AnnualComparisonExportGenerator {
  constructor(
    private readonly analytics: TerritorialAnalyticsRepository,
    private readonly privacy: TerritorialAnalyticsPrivacyPolicy,
  ) {}

  async generate(job: ClaimedExportJob): Promise<Uint8Array> {
    if (job.reportType !== 'ANNUAL_COMPARISON') throw new Error('UNSUPPORTED_REPORT_TYPE');
    const parameters = this.parameters(job.parameters);
    const [seriesA, seriesB] = await Promise.all([
      this.aggregateRange(job, 'A', parameters.rangeAStart, parameters.rangeAEnd),
      this.aggregateRange(job, 'B', parameters.rangeBStart, parameters.rangeBEnd),
    ]);
    const smallCountThreshold = this.privacy.smallCountThreshold;
    return job.format === 'XLSX'
      ? this.xlsx(job, parameters, seriesA, seriesB, smallCountThreshold)
      : this.pdf(job, parameters, seriesA, seriesB, smallCountThreshold);
  }

  private async aggregateRange(
    job: ClaimedExportJob,
    series: 'A' | 'B',
    start: string,
    end: string,
  ): Promise<MonthlyAggregate[]> {
    const result: MonthlyAggregate[] = [];
    for (const period of this.months(start, end)) {
      const [year, month] = period.split('-').map(Number);
      const rows = await this.analytics.list({
        level: this.level(job.scopeLevel),
        year: year!,
        month: month!,
        ...this.parent(job),
        scope: this.scope(job),
      });
      result.push(this.aggregate(series, period, this.privacy.protect(rows).rows));
    }
    return result;
  }

  private aggregate(
    series: 'A' | 'B',
    period: string,
    rows: readonly TerritorialAnalyticsPublicRow[],
  ): MonthlyAggregate {
    const attentions = this.protectedSum(rows, 'attentions');
    const newCases = this.protectedSum(rows, 'newCases');
    const controls = this.protectedSum(rows, 'controls');
    const alerts = this.protectedSum(rows, 'alerts');
    return {
      series,
      period,
      attentions,
      newCases,
      controls,
      totalCases: newCases === null || controls === null ? null : newCases + controls,
      alerts,
      ratePer1000:
        attentions === null || newCases === null
          ? null
          : attentions
            ? Number(((newCases / attentions) * 1000).toFixed(2))
            : 0,
      dataStatus:
        rows.length > 0 && rows.every((row) => row.dataStatus === 'OFICIAL')
          ? 'OFICIAL'
          : 'PRELIMINAR',
    };
  }

  private async xlsx(
    job: ClaimedExportJob,
    parameters: AnnualComparisonParameters,
    seriesA: readonly MonthlyAggregate[],
    seriesB: readonly MonthlyAggregate[],
    smallCountThreshold: number,
  ): Promise<Uint8Array> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SIGVITS';
    workbook.created = new Date();
    const summary = workbook.addWorksheet('Comparación', {
      views: [{ state: 'frozen', ySplit: 6 }],
    });
    const preliminary = [...seriesA, ...seriesB].some((row) => row.dataStatus === 'PRELIMINAR');
    summary.addRow([
      `SIGVITS · Comparación anual agregada · ${preliminary ? 'PRELIMINAR' : 'OFICIAL'}`,
    ]);
    summary.addRow([
      `Alcance: ${job.scopeLevel} · ${preliminary ? 'Cifras ITS 1 pendientes de depuración y aprobación institucional' : 'Períodos cerrados oficialmente'}${this.privacyNotice(smallCountThreshold)}`,
    ]);
    summary.addRow([
      `Dimensión: ${parameters.dimension === 'periods' ? 'Períodos' : 'Indicadores'}`,
    ]);
    summary.addRow([
      `Serie A: ${parameters.rangeAStart} a ${parameters.rangeAEnd} · ${this.indicatorLabel(parameters.indicatorA)}`,
    ]);
    summary.addRow([
      `Serie B: ${parameters.rangeBStart} a ${parameters.rangeBEnd} · ${this.indicatorLabel(parameters.indicatorB)}`,
    ]);
    summary.addRow([
      'Serie',
      'Rango',
      'Indicador destacado',
      'Valor destacado',
      'Atenciones',
      'Casos nuevos',
      'Controles',
      'Total casos',
      'Alertas',
      'Tasa / 1,000',
      'Madurez del dato',
    ]);
    const totalA = this.total(seriesA);
    const totalB = this.total(seriesB);
    summary.addRow([
      'A',
      `${parameters.rangeAStart} — ${parameters.rangeAEnd}`,
      this.indicatorLabel(parameters.indicatorA),
      this.metric(this.indicatorValue(totalA, parameters.indicatorA), smallCountThreshold),
      this.metric(totalA.attentions, smallCountThreshold),
      this.metric(totalA.newCases, smallCountThreshold),
      this.metric(totalA.controls, smallCountThreshold),
      this.metric(totalA.totalCases, smallCountThreshold),
      this.metric(totalA.alerts, smallCountThreshold),
      this.metric(totalA.ratePer1000, smallCountThreshold),
      totalA.dataStatus,
    ]);
    summary.addRow([
      'B',
      `${parameters.rangeBStart} — ${parameters.rangeBEnd}`,
      this.indicatorLabel(parameters.indicatorB),
      this.metric(this.indicatorValue(totalB, parameters.indicatorB), smallCountThreshold),
      this.metric(totalB.attentions, smallCountThreshold),
      this.metric(totalB.newCases, smallCountThreshold),
      this.metric(totalB.controls, smallCountThreshold),
      this.metric(totalB.totalCases, smallCountThreshold),
      this.metric(totalB.alerts, smallCountThreshold),
      this.metric(totalB.ratePer1000, smallCountThreshold),
      totalB.dataStatus,
    ]);
    summary.getRow(1).font = { bold: true, size: 14, color: { argb: 'FF0C5447' } };
    summary.getRow(6).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    summary.getRow(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0C6B5A' } };
    summary.columns = [
      { width: 10 },
      { width: 24 },
      { width: 28 },
      { width: 18 },
      { width: 15 },
      { width: 15 },
      { width: 14 },
      { width: 15 },
      { width: 12 },
      { width: 16 },
      { width: 20 },
    ];

    const detail = workbook.addWorksheet('Detalle mensual', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    detail.addRow([
      'Serie',
      'Período',
      'Atenciones',
      'Casos nuevos',
      'Controles',
      'Total casos',
      'Alertas',
      'Tasa / 1,000',
      'Madurez del dato',
    ]);
    for (const row of [...seriesA, ...seriesB])
      detail.addRow([
        row.series,
        row.period,
        this.metric(row.attentions, smallCountThreshold),
        this.metric(row.newCases, smallCountThreshold),
        this.metric(row.controls, smallCountThreshold),
        this.metric(row.totalCases, smallCountThreshold),
        this.metric(row.alerts, smallCountThreshold),
        this.metric(row.ratePer1000, smallCountThreshold),
        row.dataStatus,
      ]);
    detail.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    detail.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0C6B5A' } };
    detail.columns = [
      { width: 10 },
      { width: 14 },
      { width: 15 },
      { width: 15 },
      { width: 14 },
      { width: 15 },
      { width: 12 },
      { width: 16 },
      { width: 20 },
    ];
    detail.autoFilter = { from: 'A1', to: `I${Math.max(1, seriesA.length + seriesB.length + 1)}` };
    const buffer = await workbook.xlsx.writeBuffer();
    return new Uint8Array(buffer);
  }

  private async pdf(
    job: ClaimedExportJob,
    parameters: AnnualComparisonParameters,
    seriesA: readonly MonthlyAggregate[],
    seriesB: readonly MonthlyAggregate[],
    smallCountThreshold: number,
  ): Promise<Uint8Array> {
    const document = await PDFDocument.create();
    const regular = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);
    const pageSize: [number, number] = [792, 612];
    let page = document.addPage(pageSize);
    let y = 575;
    const preliminary = [...seriesA, ...seriesB].some((row) => row.dataStatus === 'PRELIMINAR');
    const header = (): void => {
      page.drawText('SIGVITS - Comparacion anual agregada', {
        x: 36,
        y,
        size: 15,
        font: bold,
        color: rgb(0.05, 0.35, 0.29),
      });
      y -= 20;
      page.drawText(`Alcance ${job.scopeLevel} | Dimension ${parameters.dimension}`, {
        x: 36,
        y,
        size: 9,
        font: regular,
      });
      y -= 15;
      page.drawText(
        preliminary
          ? 'DATOS PRELIMINARES DESDE ITS 1 - PENDIENTES DE APROBACION'
          : 'DATOS OFICIALES DE PERIODOS CERRADOS',
        { x: 36, y, size: 8, font: bold },
      );
      y -= 15;
      if (smallCountThreshold > 0) {
        page.drawText(
          `* CONTEO PROTEGIDO: VALOR MENOR A ${smallCountThreshold} O SUPRESION COMPLEMENTARIA`,
          { x: 36, y, size: 7, font: regular },
        );
        y -= 18;
      } else y -= 7;
      page.drawText('Serie', { x: 36, y, size: 8, font: bold });
      page.drawText('Periodo', { x: 80, y, size: 8, font: bold });
      page.drawText('Atenciones', { x: 180, y, size: 8, font: bold });
      page.drawText('Nuevos', { x: 255, y, size: 8, font: bold });
      page.drawText('Controles', { x: 320, y, size: 8, font: bold });
      page.drawText('Total', { x: 390, y, size: 8, font: bold });
      page.drawText('Alertas', { x: 450, y, size: 8, font: bold });
      page.drawText('Tasa / 1,000', { x: 510, y, size: 8, font: bold });
      y -= 14;
    };
    header();
    for (const row of [...seriesA, ...seriesB]) {
      if (y < 70) {
        page = document.addPage(pageSize);
        y = 575;
        header();
      }
      const values = [
        row.series,
        row.period,
        this.metric(row.attentions, smallCountThreshold, true),
        this.metric(row.newCases, smallCountThreshold, true),
        this.metric(row.controls, smallCountThreshold, true),
        this.metric(row.totalCases, smallCountThreshold, true),
        this.metric(row.alerts, smallCountThreshold, true),
        this.metric(row.ratePer1000, smallCountThreshold, true),
      ];
      const positions = [36, 80, 180, 255, 320, 390, 450, 510];
      values.forEach((value, index) =>
        page.drawText(String(value), { x: positions[index]!, y, size: 8, font: regular }),
      );
      y -= 13;
    }
    const totalA = this.total(seriesA);
    const totalB = this.total(seriesB);
    if (y < 100) {
      page = document.addPage(pageSize);
      y = 575;
    }
    y -= 12;
    page.drawText(
      `A ${parameters.rangeAStart}-${parameters.rangeAEnd}: ${this.indicatorLabel(parameters.indicatorA)} = ${this.metric(this.indicatorValue(totalA, parameters.indicatorA), smallCountThreshold, true)}`,
      { x: 36, y, size: 9, font: bold },
    );
    y -= 16;
    page.drawText(
      `B ${parameters.rangeBStart}-${parameters.rangeBEnd}: ${this.indicatorLabel(parameters.indicatorB)} = ${this.metric(this.indicatorValue(totalB, parameters.indicatorB), smallCountThreshold, true)}`,
      { x: 36, y, size: 9, font: bold },
    );
    return document.save();
  }

  private total(rows: readonly MonthlyAggregate[]): MonthlyAggregate {
    const attentions = this.sumVisible(rows, 'attentions');
    const newCases = this.sumVisible(rows, 'newCases');
    const controls = this.sumVisible(rows, 'controls');
    const totalCases = this.sumVisible(rows, 'totalCases');
    const alerts = this.sumVisible(rows, 'alerts');
    return {
      series: rows[0]?.series ?? 'A',
      period: '',
      attentions,
      newCases,
      controls,
      totalCases,
      alerts,
      ratePer1000:
        attentions === null || newCases === null
          ? null
          : attentions
            ? Number(((newCases / attentions) * 1000).toFixed(2))
            : 0,
      dataStatus:
        rows.length > 0 && rows.every((row) => row.dataStatus === 'OFICIAL')
          ? 'OFICIAL'
          : 'PRELIMINAR',
    };
  }

  private protectedSum(
    rows: readonly TerritorialAnalyticsPublicRow[],
    metric: 'attentions' | 'newCases' | 'controls' | 'alerts',
  ): number | null {
    return rows.some((row) => row[metric] === null)
      ? null
      : rows.reduce((total, row) => total + (row[metric] ?? 0), 0);
  }

  private sumVisible(
    rows: readonly MonthlyAggregate[],
    metric: 'attentions' | 'newCases' | 'controls' | 'totalCases' | 'alerts',
  ): number | null {
    return rows.some((row) => row[metric] === null)
      ? null
      : rows.reduce((total, row) => total + (row[metric] ?? 0), 0);
  }

  private metric(value: number | null, threshold: number, compact = false): number | string {
    if (value !== null) return value;
    return compact && threshold > 0 ? '*' : 'SUPRIMIDO';
  }

  private privacyNotice(threshold: number): string {
    return threshold > 0 ? ` · Valores <${threshold} y complementos: SUPRIMIDO` : '';
  }

  private indicatorValue(
    total: MonthlyAggregate,
    indicator: AnnualComparisonIndicator,
  ): number | null {
    if (indicator === 'TOTAL_CASES') return total.totalCases;
    if (indicator === 'NEW_CASES') return total.newCases;
    if (indicator === 'CONTROLS') return total.controls;
    if (indicator === 'ALERTS') return total.alerts;
    return total.ratePer1000;
  }

  private indicatorLabel(indicator: AnnualComparisonIndicator): string {
    return {
      TOTAL_CASES: 'Total de casos ITS',
      NEW_CASES: 'Casos nuevos',
      CONTROLS: 'Controles',
      RATE_PER_1000: 'Tasa ITS por 1,000 atenciones',
      ALERTS: 'Alertas territoriales',
    }[indicator];
  }

  private parameters(value: Record<string, unknown> | null): AnnualComparisonParameters {
    if (!value) throw new Error('INVALID_ANNUAL_COMPARISON_PARAMETERS');
    return value as unknown as AnnualComparisonParameters;
  }

  private months(start: string, end: string): string[] {
    const [startYear, startMonth] = start.split('-').map(Number);
    const [endYear, endMonth] = end.split('-').map(Number);
    const result: string[] = [];
    for (
      let cursor = startYear! * 12 + startMonth! - 1;
      cursor <= endYear! * 12 + endMonth! - 1;
      cursor += 1
    ) {
      result.push(`${Math.floor(cursor / 12)}-${String((cursor % 12) + 1).padStart(2, '0')}`);
    }
    return result;
  }

  private level(scopeLevel: ClaimedExportJob['scopeLevel']): TerritorialAnalyticsLevel {
    return scopeLevel === 'NACIONAL'
      ? 'REGION'
      : scopeLevel === 'REGION'
        ? 'MUNICIPIO'
        : 'ESTABLECIMIENTO';
  }

  private scope(job: ClaimedExportJob): TerritorialAnalyticsScope {
    if (job.scopeLevel === 'NACIONAL')
      return { national: true, regionIds: [], municipalityIds: [], facilityIds: [] };
    if (job.scopeLevel === 'REGION' || job.scopeLevel === 'MUNICIPIO')
      return { national: true, regionIds: [], municipalityIds: [], facilityIds: [] };
    return {
      national: false,
      regionIds: [],
      municipalityIds: [],
      facilityIds: job.territoryId ? [job.territoryId] : [],
    };
  }

  private parent(job: ClaimedExportJob): { regionId?: string; municipalityId?: string } {
    if (job.scopeLevel === 'REGION' && job.territoryId) return { regionId: job.territoryId };
    if (job.scopeLevel === 'MUNICIPIO' && job.territoryId)
      return { municipalityId: job.territoryId };
    return {};
  }
}
