import type {
  TerritorialAnalyticsQuery,
  TerritorialAnalyticsRow,
  TerritorialAnalyticsScope,
} from '../../domain/territorial-analytics';

export abstract class TerritorialAnalyticsRepository {
  abstract list(
    input: TerritorialAnalyticsQuery & {
      scope: TerritorialAnalyticsScope;
    },
  ): Promise<readonly TerritorialAnalyticsRow[]>;
}
