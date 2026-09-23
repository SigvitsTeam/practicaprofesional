export type TerritorialAnalyticsLevel = 'REGION' | 'MUNICIPIO' | 'ESTABLECIMIENTO';
export type TerritorialAnalyticsMetric = 'attentions' | 'newCases' | 'controls' | 'alerts';
export type TerritorialDataStatus = 'PRELIMINAR' | 'OFICIAL';

export interface TerritorialAnalyticsQuery {
  level: TerritorialAnalyticsLevel;
  year: number;
  month: number;
  regionId?: string;
  municipalityId?: string;
}

export interface TerritorialAnalyticsRow {
  id: string;
  /** Internal hierarchy key; it is never exposed by the public aggregate response. */
  parentId?: string;
  code: string;
  name: string;
  reportId?: string;
  reportVersion?: number;
  status: string;
  /** The figures come from the live ITS-1 register until the period is officially closed. */
  dataStatus: TerritorialDataStatus;
  dataSource: 'ITS1';
  attentions: number;
  newCases: number;
  controls: number;
  alerts: number;
  sourceUpdatedAt?: Date;
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
  dataStatus: TerritorialDataStatus;
  dataSource: 'ITS1';
  notice: string;
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
  attentions: number;
  newCases: number;
  controls: number;
  alerts: number;
  /** Retained for API compatibility; ITS-2 aggregate values are never suppressed. */
  suppressedMetrics: readonly TerritorialAnalyticsMetric[];
  /** Retained for API compatibility; always empty for authorized ITS-2 aggregates. */
  complementarySuppressedMetrics: readonly TerritorialAnalyticsMetric[];
}

export interface TerritorialAnalyticsScope {
  national: boolean;
  regionIds: readonly string[];
  /** Direct regional grants, excluding region IDs included only as parent context. */
  regionGrantIds?: readonly string[];
  municipalityIds: readonly string[];
  /** Municipalities granted for aggregate access, excluding contextual parents of facility grants. */
  municipalityScopeIds?: readonly string[];
  /** Direct municipal grants, excluding municipality IDs included only as parent context. */
  municipalityGrantIds?: readonly string[];
  facilityIds: readonly string[];
}

export class InvalidTerritorialAnalyticsQueryError extends Error {}
export class TerritorialAnalyticsScopeDeniedError extends Error {}
