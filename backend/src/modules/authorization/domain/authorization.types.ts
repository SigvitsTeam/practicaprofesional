export enum RoleCode {
  SuperAdmin = 'SUPERADMIN',
  CentralAdmin = 'ADMIN_CENTRAL',
  RegionalSuperAdmin = 'SUPERADMIN_REGIONAL',
  RegionalAdmin = 'ADMIN_REGIONAL',
  MunicipalCoordinator = 'COORDINADOR_MUNICIPAL',
  CoordinationDataEntry = 'DIGITADOR_COORDINACION',
  FacilityManager = 'RESPONSABLE_ESTABLECIMIENTO',
  ReadOnlySupervisor = 'SUPERVISOR_CONSULTA',
}

export enum DataLevel {
  Individual = 'INDIVIDUAL',
  Aggregated = 'AGREGADO',
  Configuration = 'CONFIGURACION',
}

export type TerritorialScopeType = 'NACIONAL' | 'REGION' | 'MUNICIPIO' | 'ESTABLECIMIENTO';

export interface GrantedTerritory {
  national: boolean;
  regionIds: readonly string[];
  /** Direct regional grants only; regionIds also includes contextual parents. Missing means none. */
  regionGrantIds?: readonly string[];
  municipalityIds: readonly string[];
  /** Municipalities granted at aggregate level, directly or through a regional grant. */
  municipalityScopeIds?: readonly string[];
  /** Direct municipal grants only; municipalityIds also includes contextual parents. Missing means none. */
  municipalityGrantIds?: readonly string[];
  facilityIds: readonly string[];
  /** Direct facility grants only; facilityIds may also include descendants of broader grants. */
  facilityGrantIds?: readonly string[];
}

export interface AuthorizationSubject {
  userId: string;
  displayName?: string;
  roles: readonly RoleCode[];
  permissions: readonly string[];
  territory: GrantedTerritory;
}

export interface TargetTerritory {
  national?: boolean;
  regionId?: string;
  municipalityId?: string;
  facilityId?: string;
}

export interface AuthorizationRequest {
  permission: string;
  dataLevel: DataLevel;
  target: TargetTerritory;
}

export type AuthorizationDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason:
        | 'MISSING_PERMISSION'
        | 'OUTSIDE_TERRITORY'
        | 'INDIVIDUAL_DATA_RESTRICTED'
        | 'ADMINISTRATIVE_ROLE_RESTRICTED';
    };
