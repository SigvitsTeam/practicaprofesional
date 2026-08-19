import type {
  CreateFacilityInput,
  CreateMunicipalityInput,
  FacilitySummary,
  MunicipalitySummary,
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
}
