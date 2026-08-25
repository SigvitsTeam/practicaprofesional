export type TerritorialAnalyticsLevel = 'REGION' | 'MUNICIPIO' | 'ESTABLECIMIENTO';

export interface TerritorialAnalyticsRow {
  id: string;
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
  rows: readonly TerritorialAnalyticsRow[];
}

export interface TerritorialAnalyticsScope {
  national: boolean;
  regionIds: readonly string[];
  municipalityIds: readonly string[];
  facilityIds: readonly string[];
}

export class InvalidTerritorialAnalyticsQueryError extends Error {}
