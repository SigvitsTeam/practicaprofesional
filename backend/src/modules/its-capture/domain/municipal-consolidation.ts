export type MunicipalConsolidationStatus =
  'BORRADOR' | 'ENVIADO_A_REGION' | 'DEVUELTO_POR_REGION' | 'APROBADO_REGION';

export interface MunicipalConsolidationSummary {
  id: string;
  status: MunicipalConsolidationStatus;
  version: number;
  municipality: { id: string; code: string; name: string };
  regionId: string;
  year: number;
  month: number;
  expectedFacilities: number;
  sourceReports: readonly {
    id: string;
    version: number;
    facility: { id: string; code: string; name: string };
  }[];
  sourceAttentionCount: number;
  attentionTotalsComplete: boolean;
  attentionsUnder15?: number;
  attentions15Plus?: number;
  currentComment?: string;
  generatedAt: Date;
  sentAt?: Date;
  approvedAt?: Date;
  openObservations: readonly { id: string; comment: string; createdAt: Date }[];
}

export interface MunicipalReportTerritory {
  municipalityId: string;
  regionId: string;
}

export interface MunicipalConsolidationContext {
  municipalities: readonly {
    id: string;
    code: string;
    name: string;
    regionId: string;
    activeFacilities: number;
  }[];
}

export interface MunicipalPreliminaryReportSource {
  municipality: {
    id: string;
    code: string;
    name: string;
    regionId: string;
    regionName: string;
  };
  facilities: readonly { id: string; code: string; name: string }[];
}

export interface MunicipalPreliminaryReport {
  municipality: MunicipalPreliminaryReportSource['municipality'];
  year: number;
  month: number;
  dataStatus: 'PRELIMINAR';
  dataSource: 'ITS1';
  notice: string;
  privacy: {
    smallCountThreshold: number;
    suppressedValue: null;
  };
  rows: readonly {
    id: string;
    code: string;
    name: string;
    status: string;
    attentions: number;
    newCases: number;
    controls: number;
    alerts: number;
    suppressedMetrics: readonly string[];
    complementarySuppressedMetrics: readonly string[];
  }[];
}

export class MunicipalConsolidationError extends Error {}
export class MunicipalConsolidationNotFoundError extends Error {}
export class MunicipalConsolidationAccessError extends Error {}
