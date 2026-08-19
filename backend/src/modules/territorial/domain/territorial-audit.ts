export interface TerritorialAuditEvent {
  id: string;
  action: string;
  entity: string;
  reason: string | null;
  actorName: string | null;
  createdAt: Date;
}

export interface TerritorialAuditPage {
  items: TerritorialAuditEvent[];
  nextCursor: string | null;
}

export class TerritorialAuditTargetNotFoundError extends Error {}
export class TerritorialAuditScopeDeniedError extends Error {}
