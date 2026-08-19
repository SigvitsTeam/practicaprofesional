import type {
  CreateFacilityInput,
  CreateMunicipalityInput,
  FacilitySummary,
  MunicipalitySummary,
  TerritorialEntityType,
  TerritorialStatusContext,
} from '../../domain/territorial-catalog';

export abstract class TerritorialCatalogRepository {
  abstract listMunicipalities(regionIds?: readonly string[]): Promise<MunicipalitySummary[]>;
  abstract listFacilities(municipalityIds?: readonly string[]): Promise<FacilitySummary[]>;
  abstract findRegion(regionId: string): Promise<{ id: string; active: boolean } | null>;
  abstract findMunicipality(
    municipalityId: string,
  ): Promise<{ id: string; regionId: string; active: boolean } | null>;
  abstract createMunicipality(input: CreateMunicipalityInput): Promise<MunicipalitySummary>;
  abstract createFacility(input: CreateFacilityInput): Promise<FacilitySummary>;
  abstract findStatusContext(
    entityType: TerritorialEntityType,
    id: string,
  ): Promise<TerritorialStatusContext | null>;
  abstract updateStatus(input: {
    entityType: TerritorialEntityType;
    id: string;
    status: import('../../domain/region').OperationalStatus;
    expectedUpdatedAt: Date;
    audit: import('../../domain/region').AuditContext;
  }): Promise<TerritorialStatusContext>;
}
