import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { MonthlyReportSource } from '../../its-capture/domain/its-monthly-report';
import { MunicipalIts2ExportRepository } from '../application/ports/municipal-its2-export.repository';
import {
  InvalidExportJobError,
  type MunicipalConsolidatedExportParameters,
  type ResolvedMunicipalExportRange,
} from '../domain/export-job';

const MAX_MONTHS = 24;
const MAX_WEEKS = 104;
const DAY_MS = 86_400_000;

@Injectable()
export class PrismaMunicipalIts2ExportRepository extends MunicipalIts2ExportRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  resolveRange(
    parameters: MunicipalConsolidatedExportParameters,
  ): Promise<ResolvedMunicipalExportRange> {
    return parameters.timeUnit === 'MONTH'
      ? this.resolveMonthlyRange(parameters)
      : this.resolveEpidemiologicalRange(parameters);
  }

  async getReportSource(input: {
    municipalityId: string;
    range: ResolvedMunicipalExportRange;
  }): Promise<MonthlyReportSource> {
    const timeFilter =
      input.range.parameters.timeUnit === 'EPIDEMIOLOGICAL_WEEK'
        ? {
            epidemiologicalWeekId: {
              in: [...(input.range.epidemiologicalWeekIds ?? [])],
            },
          }
        : {
            attentionDate: {
              gte: input.range.startDate,
              lte: input.range.endDate,
            },
          };
    const [municipality, ageGroups, diseases, attentions] = await Promise.all([
      this.prisma.client.municipality.findFirst({
        where: { id: input.municipalityId, active: true },
        select: {
          id: true,
          officialCode: true,
          name: true,
          region: { select: { name: true } },
        },
      }),
      this.prisma.client.ageGroup.findMany({
        where: { active: true },
        orderBy: { formatOrder: 'asc' },
        select: { code: true, name: true, formatOrder: true },
      }),
      this.prisma.client.itsDisease.findMany({
        where: { active: true, classification: { active: true, program: { code: 'ITS' } } },
        orderBy: { formatOrder: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          appliesToMale: true,
          appliesToFemale: true,
          formatOrder: true,
          classification: { select: { code: true, name: true } },
        },
      }),
      this.prisma.client.itsAttention.findMany({
        where: {
          municipalityId: input.municipalityId,
          status: 'ACTIVO',
          ...timeFilter,
        },
        select: {
          sex: true,
          age: true,
          isContact: true,
          isPregnant: true,
          ageGroup: { select: { code: true } },
          populationType: { select: { code: true } },
          diagnoses: { select: { diseaseId: true, caseType: true } },
        },
      }),
    ]);
    if (!municipality) throw new InvalidExportJobError('El municipio solicitado no está activo.');

    return {
      facility: {
        id: municipality.id,
        code: municipality.officialCode,
        name: 'CONSOLIDADO MUNICIPAL',
        municipalityName: municipality.name,
        regionName: municipality.region.name,
      },
      ageGroups,
      diseases: diseases.map((disease) => ({
        id: disease.id,
        code: disease.code ?? undefined,
        name: disease.name,
        classificationCode: disease.classification.code,
        classificationName: disease.classification.name,
        appliesToMale: disease.appliesToMale,
        appliesToFemale: disease.appliesToFemale,
        formatOrder: disease.formatOrder,
      })),
      attentions: attentions.map((attention) => ({
        sex: attention.sex,
        age: attention.age,
        ageGroupCode: attention.ageGroup.code,
        populationTypeCode: attention.populationType.code,
        isContact: attention.isContact,
        isPregnant: attention.isPregnant,
        diagnoses: attention.diagnoses,
      })),
    };
  }

  private async resolveMonthlyRange(
    parameters: MunicipalConsolidatedExportParameters,
  ): Promise<ResolvedMunicipalExportRange> {
    const start = this.parseMonth(parameters.startPeriod);
    const end = this.parseMonth(parameters.endPeriod);
    const keys = this.monthKeys(start, end);
    if (keys.length > MAX_MONTHS)
      throw new InvalidExportJobError('El rango municipal puede abarcar como máximo 24 meses.');
    const periods = await this.prisma.client.reportingPeriod.findMany({
      where: {
        type: 'MENSUAL',
        OR: keys.map((item) => ({ year: item.year, month: item.month })),
      },
      select: { year: true, month: true, startDate: true, endDate: true },
    });
    const byKey = new Map(periods.map((period) => [`${period.year}-${period.month}`, period]));
    const ordered = keys.map((item) => byKey.get(`${item.year}-${item.month}`));
    if (ordered.some((period) => !period))
      throw new InvalidExportJobError(
        'El rango mensual no está completo en el calendario institucional.',
      );
    if (
      ordered.some(
        (period, index) =>
          index > 0 &&
          this.utcDay(period!.startDate) !== this.utcDay(ordered[index - 1]!.endDate) + DAY_MS,
      )
    )
      throw new InvalidExportJobError(
        'El rango mensual no es continuo en el calendario institucional.',
      );
    const first = ordered[0];
    const last = ordered.at(-1);
    if (!first || !last)
      throw new InvalidExportJobError('El rango mensual solicitado no es válido.');
    const sameYear = start.year === end.year;
    return {
      parameters,
      startDate: first.startDate,
      endDate: last.endDate,
      anchorYear: end.year,
      anchorMonth: end.month,
      periodLabel: sameYear
        ? `${this.two(start.month)}–${this.two(end.month)}`
        : `${this.two(start.month)}/${start.year}–${this.two(end.month)}/${end.year}`,
      yearLabel: sameYear ? String(end.year) : `${start.year}–${end.year}`,
      filenameLabel: `MES-${parameters.startPeriod}_a_${parameters.endPeriod}`,
    };
  }

  private async resolveEpidemiologicalRange(
    parameters: MunicipalConsolidatedExportParameters,
  ): Promise<ResolvedMunicipalExportRange> {
    const start = this.parseWeek(parameters.startPeriod);
    const end = this.parseWeek(parameters.endPeriod);
    const [first, last] = await Promise.all([
      this.prisma.client.epidemiologicalWeek.findFirst({
        where: { year: start.year, weekNumber: start.week, active: true },
        select: { id: true, year: true, weekNumber: true, startDate: true, endDate: true },
      }),
      this.prisma.client.epidemiologicalWeek.findFirst({
        where: { year: end.year, weekNumber: end.week, active: true },
        select: { id: true, year: true, weekNumber: true, startDate: true, endDate: true },
      }),
    ]);
    if (!first || !last || first.startDate > last.startDate)
      throw new InvalidExportJobError(
        'El rango de semanas no existe o está invertido en el calendario institucional.',
      );
    const weeks = await this.prisma.client.epidemiologicalWeek.findMany({
      where: {
        active: true,
        startDate: { gte: first.startDate },
        endDate: { lte: last.endDate },
      },
      orderBy: { startDate: 'asc' },
      select: { id: true, year: true, weekNumber: true, startDate: true, endDate: true },
    });
    if (weeks.length === 0 || weeks.length > MAX_WEEKS)
      throw new InvalidExportJobError(
        weeks.length > MAX_WEEKS
          ? 'El rango municipal puede abarcar como máximo 104 semanas epidemiológicas.'
          : 'El rango de semanas solicitado no está disponible.',
      );
    if (
      weeks[0]?.id !== first.id ||
      weeks.at(-1)?.id !== last.id ||
      weeks.some((week, index) => {
        if (index === 0) return false;
        const previous = weeks[index - 1];
        return !previous || this.utcDay(week.startDate) !== this.utcDay(previous.endDate) + DAY_MS;
      })
    )
      throw new InvalidExportJobError(
        'El rango de semanas no es continuo en el calendario institucional.',
      );
    const sameYear = start.year === end.year;
    return {
      parameters,
      startDate: first.startDate,
      endDate: last.endDate,
      anchorYear: last.endDate.getUTCFullYear(),
      anchorMonth: last.endDate.getUTCMonth() + 1,
      periodLabel: sameYear
        ? `SE${this.two(start.week)}–SE${this.two(end.week)}`
        : `SE${this.two(start.week)}/${start.year}–SE${this.two(end.week)}/${end.year}`,
      yearLabel: sameYear ? String(end.year) : `${start.year}–${end.year}`,
      filenameLabel: `SE-${parameters.startPeriod}_a_${parameters.endPeriod}`,
      epidemiologicalWeekIds: weeks.map((week) => week.id),
    };
  }

  private parseMonth(value: string): { year: number; month: number } {
    const match = /^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.exec(value);
    if (!match)
      throw new InvalidExportJobError('Los meses deben usar el formato institucional YYYY-MM.');
    return { year: Number(match[1]), month: Number(match[2]) };
  }

  private parseWeek(value: string): { year: number; week: number } {
    const match = /^(20\d{2}|2100)-W(0[1-9]|[1-4]\d|5[0-3])$/.exec(value);
    if (!match)
      throw new InvalidExportJobError(
        'Las semanas epidemiológicas deben usar el formato YYYY-Www.',
      );
    return { year: Number(match[1]), week: Number(match[2]) };
  }

  private monthKeys(
    start: { year: number; month: number },
    end: { year: number; month: number },
  ): { year: number; month: number }[] {
    const startIndex = start.year * 12 + start.month - 1;
    const endIndex = end.year * 12 + end.month - 1;
    if (endIndex < startIndex)
      throw new InvalidExportJobError('El rango mensual no puede estar invertido.');
    return Array.from({ length: endIndex - startIndex + 1 }, (_, offset) => {
      const index = startIndex + offset;
      return { year: Math.floor(index / 12), month: (index % 12) + 1 };
    });
  }

  private two(value: number): string {
    return String(value).padStart(2, '0');
  }

  private utcDay(value: Date): number {
    return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }
}
