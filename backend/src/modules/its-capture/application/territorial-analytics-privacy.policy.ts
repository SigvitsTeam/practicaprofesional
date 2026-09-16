import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  TerritorialAnalyticsMetric,
  TerritorialAnalyticsPublicRow,
  TerritorialAnalyticsRow,
} from '../domain/territorial-analytics';

export interface ProtectedTerritorialAnalyticsRows {
  smallCountThreshold: number;
  suppressedValue: null;
  rows: readonly TerritorialAnalyticsPublicRow[];
}

/**
 * Applies the same primary and complementary small-count suppression to every
 * public representation of territorial analytics, including downloadable files.
 */
@Injectable()
export class TerritorialAnalyticsPrivacyPolicy {
  constructor(private readonly config: ConfigService) {}

  get smallCountThreshold(): number {
    return this.config.get<number>('app.territorialAnalyticsSmallCountThreshold', 5);
  }

  protect(rows: readonly TerritorialAnalyticsRow[]): ProtectedTerritorialAnalyticsRows {
    const threshold = this.smallCountThreshold;
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

    return {
      smallCountThreshold: threshold,
      suppressedValue: null,
      rows: rows.map((row, index) => {
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
      }),
    };
  }
}
