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

export class MunicipalConsolidationError extends Error {}
export class MunicipalConsolidationNotFoundError extends Error {}
export class MunicipalConsolidationAccessError extends Error {}
