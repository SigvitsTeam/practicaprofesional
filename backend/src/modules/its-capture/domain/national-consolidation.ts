export type NationalConsolidationStatus =
  'BORRADOR' | 'CONSOLIDADO_NACIONAL' | 'CERRADO_OFICIAL' | 'REABIERTO_AUTORIZADO';

export interface NationalConsolidationContext {
  activeRegions: number;
}

export interface NationalConsolidationSummary {
  id: string;
  status: NationalConsolidationStatus;
  version: number;
  year: number;
  month: number;
  periodStatus: 'ABIERTO' | 'CERRADO' | 'BLOQUEADO';
  expectedRegions: number;
  sourceReports: readonly {
    id: string;
    version: number;
    region: { id: string; code: string; name: string };
  }[];
  sourceAttentionCount: number;
  attentionTotalsComplete: boolean;
  attentionsUnder15?: number;
  attentions15Plus?: number;
  currentComment?: string;
  generatedAt: Date;
  closedAt?: Date;
}

export class NationalConsolidationError extends Error {}
export class NationalConsolidationNotFoundError extends Error {}
export class NationalConsolidationAccessError extends Error {}
