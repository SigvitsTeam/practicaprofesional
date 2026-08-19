import type { OperationalStatus } from './region';
import type { AuditContext } from './region';

export interface NetworkMunicipalitySummary {
  id: string;
  code: string;
  name: string;
  startDate: Date;
}

export interface HealthNetworkSummary {
  id: string;
  regionId: string;
  regionName: string;
  code: string;
  name: string;
  description: string | null;
  operationalStatus: OperationalStatus;
  startDate: Date;
  active: boolean;
  municipalities: NetworkMunicipalitySummary[];
  updatedAt: Date;
}

export interface CreateHealthNetworkInput {
  regionId: string;
  code: string;
  name: string;
  description: string | null;
  operationalStatus: OperationalStatus;
  startDate: Date;
  municipalityIds: string[];
  audit: AuditContext;
}

export class InvalidHealthNetworkError extends Error {}
export class HealthNetworkConflictError extends Error {}
export class HealthNetworkNotFoundError extends Error {}
export class HealthNetworkConcurrencyError extends Error {}
export class HealthNetworkStatusTransitionError extends Error {}
