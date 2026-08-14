export type ItsReportWorkflowStatus =
  'BORRADOR' | 'ENVIADO_A_MUNICIPIO' | 'DEVUELTO_POR_MUNICIPIO' | 'APROBADO_MUNICIPIO';

export interface PrepareIts2ReportInput {
  facilityId: string;
  year: number;
  month: number;
  attentionsUnder15?: number;
  attentions15Plus?: number;
  attentionTotalsSource?: string;
  comment?: string;
  userId: string;
}

export interface Its2ReportSummary {
  id: string;
  status: ItsReportWorkflowStatus;
  version: number;
  facility: { id: string; code: string; name: string };
  municipalityId: string;
  year: number;
  month: number;
  totalAttentions: number;
  attentionTotalsComplete: boolean;
  attentionsUnder15?: number;
  attentions15Plus?: number;
  attentionTotalsSource?: string;
  currentComment?: string;
  generatedAt: Date;
  sentAt?: Date;
  approvedAt?: Date;
  openObservations: { id: string; comment: string; createdAt: Date }[];
}

export interface ReportTerritory {
  facilityId?: string;
  municipalityId?: string;
}

export class ItsReportWorkflowError extends Error {}
export class ItsReportNotFoundError extends Error {}
export class ItsReportAccessError extends Error {}
