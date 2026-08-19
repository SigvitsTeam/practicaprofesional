import type { OperationalStatus } from './region';
import type { AuditContext } from './region';

export interface MunicipalitySummary {
  id: string;
  regionId: string;
  regionName: string;
  officialCode: string;
  name: string;
  operationalStatus: OperationalStatus;
  mapValidated: boolean;
  active: boolean;
  facilityCount: number;
}

export interface FacilitySummary {
  id: string;
  municipalityId: string;
  municipalityName: string;
  code: string;
  name: string;
  type: string;
  address: string | null;
  operationalStatus: OperationalStatus;
  coordinatesValidated: boolean;
  active: boolean;
}

export interface CreateMunicipalityInput {
  regionId: string;
  officialCode: string;
  name: string;
  audit: AuditContext;
}

export interface CreateFacilityInput {
  municipalityId: string;
  code: string;
  name: string;
  type: string;
  address: string | null;
  audit: AuditContext;
}

export class InvalidTerritorialDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = InvalidTerritorialDataError.name;
  }
}

export class TerritorialCodeAlreadyExistsError extends Error {
  constructor(readonly code: string) {
    super(`Ya existe un territorio con el código ${code}.`);
    this.name = TerritorialCodeAlreadyExistsError.name;
  }
}

export class TerritorialParentNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = TerritorialParentNotFoundError.name;
  }
}

export class TerritorialScopeDeniedError extends Error {
  constructor() {
    super('El territorio solicitado está fuera del alcance administrativo asignado.');
    this.name = TerritorialScopeDeniedError.name;
  }
}
