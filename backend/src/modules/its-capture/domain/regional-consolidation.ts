export type RegionalConsolidationStatus =
  'BORRADOR' | 'ENVIADO_A_CENTRAL' | 'DEVUELTO_POR_CENTRAL' | 'APROBADO_CENTRAL';

export interface RegionalConsolidationContext {
  regions: readonly {
    id: string;
    code: string;
    name: string;
    activeMunicipalities: number;
  }[];
}

export interface RegionalConsolidationSummary {
  id: string;
  status: RegionalConsolidationStatus;
  version: number;
  region: { id: string; code: string; name: string };
  year: number;
  month: number;
  expectedMunicipalities: number;
  sourceReports: readonly {
    id: string;
    version: number;
    municipality: { id: string; code: string; name: string };
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

export class RegionalConsolidationError extends Error {}
export class RegionalConsolidationNotFoundError extends Error {}
export class RegionalConsolidationAccessError extends Error {}
