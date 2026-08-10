export enum RegionType {
  Health = 'SANITARIA',
  Departmental = 'DEPARTAMENTAL',
  Metropolitan = 'METROPOLITANA',
}

export enum OperationalStatus {
  Preconfigured = 'PRECONFIGURADO',
  Created = 'CREADO',
  InPilot = 'EN_PILOTAJE',
  Active = 'ACTIVO',
  Inactive = 'INACTIVO',
  Suspended = 'SUSPENDIDO',
}

export interface Region {
  id: string;
  code: string;
  name: string;
  regionNumber: string | null;
  type: RegionType;
  operationalStatus: OperationalStatus;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewRegion {
  code: string;
  name: string;
  regionNumber: string | null;
  type: RegionType;
}

export interface AuditContext {
  actorUserId: string;
  requestId: string;
  reason?: string;
}

export class RegionCodeAlreadyExistsError extends Error {
  constructor(readonly code: string) {
    super(`Ya existe una región con el código ${code}.`);
    this.name = RegionCodeAlreadyExistsError.name;
  }
}

export class InvalidRegionDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = InvalidRegionDataError.name;
  }
}
