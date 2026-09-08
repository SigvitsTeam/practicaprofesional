export type TerritorialAnalyticsLevel = 'REGION' | 'MUNICIPIO' | 'ESTABLECIMIENTO';
export type TerritorialAnalyticsMetric = 'attentions' | 'newCases' | 'controls' | 'alerts';

export interface TerritorialAnalyticsQuery {
  level: TerritorialAnalyticsLevel;
  year: number;
  month: number;
  regionId?: string;
  municipalityId?: string;
}

export interface TerritorialAnalyticsRow {
  id: string;
  /** Internal grouping key used for deterministic complementary suppression. */
  parentId?: string;
  code: string;
  name: string;
  reportId?: string;
  reportVersion?: number;
  status: string;
  attentions: number;
  newCases: number;
  controls: number;
  alerts: number;
  sentAt?: Date;
  latitude?: number;
  longitude?: number;
  coordinatesValidated?: boolean;
}

export interface TerritorialAnalyticsResult {
  level: TerritorialAnalyticsLevel;
  year: number;
  month: number;
  regionId?: string;
  municipalityId?: string;
  privacy: {
    smallCountThreshold: number;
    suppressedValue: null;
  };
  rows: readonly TerritorialAnalyticsPublicRow[];
}

export interface TerritorialAnalyticsPublicRow extends Omit<
  TerritorialAnalyticsRow,
  TerritorialAnalyticsMetric | 'parentId'
> {
  attentions: number | null;
  newCases: number | null;
  controls: number | null;
  alerts: number | null;
  /** Metrics hidden because their positive value is below the configured threshold. */
  suppressedMetrics: readonly TerritorialAnalyticsMetric[];
  /**
   * Additional metrics hidden to prevent recovering the only small value by subtraction.
   * Unlike suppressedMetrics, these values may be greater than or equal to the threshold.
   */
  complementarySuppressedMetrics: readonly TerritorialAnalyticsMetric[];
}

export interface TerritorialAnalyticsScope {
  national: boolean;
  regionIds: readonly string[];
  municipalityIds: readonly string[];
  facilityIds: readonly string[];
}

export class InvalidTerritorialAnalyticsQueryError extends Error {}
export class TerritorialAnalyticsScopeDeniedError extends Error {}
