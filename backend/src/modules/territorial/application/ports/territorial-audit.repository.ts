import type { TerritorialAuditPage } from '../../domain/territorial-audit';

export abstract class TerritorialAuditRepository {
  abstract findTerritoryRegion(
    type: 'REGION' | 'ESTABLECIMIENTO',
    id: string,
  ): Promise<string | null>;
  abstract listTerritoryEvents(input: {
    entityType: 'NACIONAL' | 'REGION' | 'ESTABLECIMIENTO';
    entityId?: string;
    regionIds?: readonly string[];
    limit: number;
    cursor?: string;
  }): Promise<TerritorialAuditPage>;
  abstract findMunicipalityRegion(municipalityId: string): Promise<string | null>;
  abstract findNetworkRegion(networkId: string): Promise<string | null>;
  abstract listMunicipalityEvents(input: {
    municipalityId: string;
    limit: number;
    cursor?: string;
  }): Promise<TerritorialAuditPage>;
  abstract listNetworkEvents(input: {
    networkId: string;
    limit: number;
    cursor?: string;
  }): Promise<TerritorialAuditPage>;
}
