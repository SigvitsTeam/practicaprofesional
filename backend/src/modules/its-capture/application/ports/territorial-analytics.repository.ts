import type {
  TerritorialAnalyticsLevel,
  TerritorialAnalyticsRow,
  TerritorialAnalyticsScope,
} from '../../domain/territorial-analytics';

export abstract class TerritorialAnalyticsRepository {
  abstract list(input: {
    level: TerritorialAnalyticsLevel;
    year: number;
    month: number;
    scope: TerritorialAnalyticsScope;
  }): Promise<readonly TerritorialAnalyticsRow[]>;
}
