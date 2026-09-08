import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthorizationSubject } from '../../authorization/domain/authorization.types';
import {
  InvalidTerritorialAnalyticsQueryError,
  TerritorialAnalyticsScopeDeniedError,
  type TerritorialAnalyticsMetric,
  type TerritorialAnalyticsPublicRow,
  type TerritorialAnalyticsQuery,
  type TerritorialAnalyticsRow,
  type TerritorialAnalyticsResult,
} from '../domain/territorial-analytics';
import { TerritorialAnalyticsRepository } from './ports/territorial-analytics.repository';

@Injectable()
export class TerritorialAnalyticsUseCase {
  constructor(
    private readonly repository: TerritorialAnalyticsRepository,
    private readonly config: ConfigService,
  ) {}

  async execute(
    input: TerritorialAnalyticsQuery,
    subject: AuthorizationSubject,
  ): Promise<TerritorialAnalyticsResult> {
    if (!Number.isInteger(input.year) || input.year < 2020 || input.year > 2100)
      throw new InvalidTerritorialAnalyticsQueryError('El año solicitado no es válido.');
    if (!Number.isInteger(input.month) || input.month < 1 || input.month > 12)
      throw new InvalidTerritorialAnalyticsQueryError('El mes solicitado no es válido.');
    if (input.level === 'REGION' && !subject.territory.national)
      throw new InvalidTerritorialAnalyticsQueryError(
        'El nivel regional agregado requiere alcance nacional.',
      );
    this.validateParent(input, subject);
    const rows = await this.repository.list({
      ...input,
      scope: subject.territory,
    });
    const smallCountThreshold = this.config.get<number>(
      'app.territorialAnalyticsSmallCountThreshold',
      5,
    );
    return {
      ...input,
      privacy: { smallCountThreshold, suppressedValue: null },
      rows: this.suppress(rows, smallCountThreshold),
    };
  }

  private validateParent(input: TerritorialAnalyticsQuery, subject: AuthorizationSubject): void {
    if (input.level === 'REGION' && (input.regionId || input.municipalityId))
      throw new InvalidTerritorialAnalyticsQueryError(
        'El nivel regional no admite un territorio padre.',
      );
    if (input.level === 'MUNICIPIO' && input.municipalityId)
      throw new InvalidTerritorialAnalyticsQueryError(
        'El nivel municipal sólo admite regionId como territorio padre.',
      );
    if (input.level === 'ESTABLECIMIENTO' && input.regionId)
      throw new InvalidTerritorialAnalyticsQueryError(
        'El nivel de establecimiento sólo admite municipalityId como territorio padre.',
      );
    if (
      input.regionId &&
      !subject.territory.national &&
      !subject.territory.regionIds.includes(input.regionId)
    )
      throw new TerritorialAnalyticsScopeDeniedError(
        'La región solicitada está fuera del alcance autorizado.',
      );
    if (
      input.municipalityId &&
      !subject.territory.national &&
      !subject.territory.municipalityIds.includes(input.municipalityId)
    )
      throw new TerritorialAnalyticsScopeDeniedError(
        'El municipio solicitado está fuera del alcance autorizado.',
      );
  }

  private suppress(
    rows: readonly TerritorialAnalyticsRow[],
    threshold: number,
  ): readonly TerritorialAnalyticsPublicRow[] {
    const metrics = [
      'attentions',
      'newCases',
      'controls',
      'alerts',
    ] as const satisfies readonly TerritorialAnalyticsMetric[];
    const primary = rows.map(
      (row) =>
        new Set<TerritorialAnalyticsMetric>(
          metrics.filter((metric) => threshold > 0 && row[metric] > 0 && row[metric] < threshold),
        ),
    );
    const complementary = rows.map(() => new Set<TerritorialAnalyticsMetric>());
    const groups = new Map<string, number[]>();
    rows.forEach((row, index) => {
      const key = row.parentId ?? 'AUTHORIZED_SCOPE';
      groups.set(key, [...(groups.get(key) ?? []), index]);
    });

    for (const metric of metrics) {
      for (const indexes of groups.values()) {
        const primaryIndexes = indexes.filter((index) => primary[index]?.has(metric));
        if (primaryIndexes.length !== 1) continue;

        const candidate = indexes
          .map((index) => ({ index, id: rows[index]?.id ?? '', value: rows[index]?.[metric] ?? 0 }))
          .filter(({ index, value }) => !primary[index]?.has(metric) && value > 0)
          .sort((left, right) => left.value - right.value || left.id.localeCompare(right.id))[0];
        if (candidate) complementary[candidate.index]?.add(metric);
      }
    }

    return rows.map((row, index) => {
      const primaryMetrics = primary[index] ?? new Set<TerritorialAnalyticsMetric>();
      const complementaryMetrics = complementary[index] ?? new Set<TerritorialAnalyticsMetric>();
      const hidden = (metric: TerritorialAnalyticsMetric): boolean =>
        primaryMetrics.has(metric) || complementaryMetrics.has(metric);
      const publicRow = { ...row };
      delete publicRow.parentId;
      return {
        ...publicRow,
        attentions: hidden('attentions') ? null : row.attentions,
        newCases: hidden('newCases') ? null : row.newCases,
        controls: hidden('controls') ? null : row.controls,
        alerts: hidden('alerts') ? null : row.alerts,
        suppressedMetrics: metrics.filter((metric) => primaryMetrics.has(metric)),
        complementarySuppressedMetrics: metrics.filter((metric) =>
          complementaryMetrics.has(metric),
        ),
      };
    });
  }
}
