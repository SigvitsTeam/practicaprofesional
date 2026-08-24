import type { TerritorialAuditPage } from '../../domain/territorial-audit';

export abstract class TerritorialAuditRepository {
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
