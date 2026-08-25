import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { TerritorialAnalyticsRepository } from '../../its-capture/application/ports/territorial-analytics.repository';
import type {
  TerritorialAnalyticsLevel,
  TerritorialAnalyticsRow,
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
  attentions: number;
  newCases: number;
  controls: number;
  totalCases: number;
  alerts: number;
  ratePer1000: number;
}

@Injectable()
export class AnnualComparisonExportGenerator {
  constructor(private readonly analytics: TerritorialAnalyticsRepository) {}

  async generate(job: ClaimedExportJob): Promise<Uint8Array> {
    if (job.reportType !== 'ANNUAL_COMPARISON') throw new Error('UNSUPPORTED_REPORT_TYPE');
    const parameters = this.parameters(job.parameters);
    const [seriesA, seriesB] = await Promise.all([
      this.aggregateRange(job, 'A', parameters.rangeAStart, parameters.rangeAEnd),
      this.aggregateRange(job, 'B', parameters.rangeBStart, parameters.rangeBEnd),
    ]);
    return job.format === 'XLSX'
      ? this.xlsx(job, parameters, seriesA, seriesB)
      : this.pdf(job, parameters, seriesA, seriesB);
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
        scope: this.scope(job),
      });
      result.push(this.aggregate(series, period, rows));
    }
    return result;
  }

  private aggregate(
    series: 'A' | 'B',
    period: string,
    rows: readonly TerritorialAnalyticsRow[],
  ): MonthlyAggregate {
    const attentions = rows.reduce((total, row) => total + row.attentions, 0);
    const newCases = rows.reduce((total, row) => total + row.newCases, 0);
    const controls = rows.reduce((total, row) => total + row.controls, 0);
    const alerts = rows.reduce((total, row) => total + row.alerts, 0);
    return {
      series,
      period,
      attentions,
      newCases,
      controls,
      totalCases: newCases + controls,
      alerts,
      ratePer1000: attentions ? Number(((newCases / attentions) * 1000).toFixed(2)) : 0,
    };
  }

  private async xlsx(
    job: ClaimedExportJob,
    parameters: AnnualComparisonParameters,
    seriesA: readonly MonthlyAggregate[],
    seriesB: readonly MonthlyAggregate[],
  ): Promise<Uint8Array> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SIGVITS';
    workbook.created = new Date();
    const summary = workbook.addWorksheet('Comparación', {
      views: [{ state: 'frozen', ySplit: 6 }],
    });
    summary.addRow(['SIGVITS · Comparación anual agregada']);
    summary.addRow([`Alcance: ${job.scopeLevel}`]);
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
    ]);
    const totalA = this.total(seriesA);
    const totalB = this.total(seriesB);
    summary.addRow([
      'A',
      `${parameters.rangeAStart} — ${parameters.rangeAEnd}`,
      this.indicatorLabel(parameters.indicatorA),
      this.indicatorValue(totalA, parameters.indicatorA),
      totalA.attentions,
      totalA.newCases,
      totalA.controls,
      totalA.totalCases,
      totalA.alerts,
      totalA.ratePer1000,
    ]);
    summary.addRow([
      'B',
      `${parameters.rangeBStart} — ${parameters.rangeBEnd}`,
      this.indicatorLabel(parameters.indicatorB),
      this.indicatorValue(totalB, parameters.indicatorB),
      totalB.attentions,
      totalB.newCases,
      totalB.controls,
      totalB.totalCases,
      totalB.alerts,
      totalB.ratePer1000,
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
    ]);
    for (const row of [...seriesA, ...seriesB])
      detail.addRow([
        row.series,
        row.period,
        row.attentions,
        row.newCases,
        row.controls,
        row.totalCases,
        row.alerts,
        row.ratePer1000,
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
    ];
    detail.autoFilter = { from: 'A1', to: `H${Math.max(1, seriesA.length + seriesB.length + 1)}` };
    const buffer = await workbook.xlsx.writeBuffer();
    return new Uint8Array(buffer);
  }

  private async pdf(
    job: ClaimedExportJob,
    parameters: AnnualComparisonParameters,
    seriesA: readonly MonthlyAggregate[],
    seriesB: readonly MonthlyAggregate[],
  ): Promise<Uint8Array> {
    const document = await PDFDocument.create();
    const regular = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);
    const pageSize: [number, number] = [792, 612];
    let page = document.addPage(pageSize);
    let y = 575;
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
      y -= 22;
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
        row.attentions,
        row.newCases,
        row.controls,
        row.totalCases,
        row.alerts,
        row.ratePer1000,
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
      `A ${parameters.rangeAStart}-${parameters.rangeAEnd}: ${this.indicatorLabel(parameters.indicatorA)} = ${this.indicatorValue(totalA, parameters.indicatorA)}`,
      { x: 36, y, size: 9, font: bold },
    );
    y -= 16;
    page.drawText(
      `B ${parameters.rangeBStart}-${parameters.rangeBEnd}: ${this.indicatorLabel(parameters.indicatorB)} = ${this.indicatorValue(totalB, parameters.indicatorB)}`,
      { x: 36, y, size: 9, font: bold },
    );
    return document.save();
  }

  private total(rows: readonly MonthlyAggregate[]): MonthlyAggregate {
    const total = rows.reduce(
      (accumulator, row) => ({
        attentions: accumulator.attentions + row.attentions,
        newCases: accumulator.newCases + row.newCases,
        controls: accumulator.controls + row.controls,
        totalCases: accumulator.totalCases + row.totalCases,
        alerts: accumulator.alerts + row.alerts,
      }),
      { attentions: 0, newCases: 0, controls: 0, totalCases: 0, alerts: 0 },
    );
    return {
      series: rows[0]?.series ?? 'A',
      period: '',
      ...total,
      ratePer1000: total.attentions
        ? Number(((total.newCases / total.attentions) * 1000).toFixed(2))
        : 0,
    };
  }

  private indicatorValue(total: MonthlyAggregate, indicator: AnnualComparisonIndicator): number {
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
    return {
      national: job.scopeLevel === 'NACIONAL',
      regionIds: job.scopeLevel === 'REGION' && job.territoryId ? [job.territoryId] : [],
      municipalityIds: job.scopeLevel === 'MUNICIPIO' && job.territoryId ? [job.territoryId] : [],
      facilityIds: job.scopeLevel === 'ESTABLECIMIENTO' && job.territoryId ? [job.territoryId] : [],
    };
  }
}
