import type { TerritorialAuditPage } from '../../domain/territorial-audit';

export abstract class TerritorialAuditRepository {
  abstract findMunicipalityRegion(municipalityId: string): Promise<string | null>;
  abstract listMunicipalityEvents(input: {
    municipalityId: string;
    limit: number;
    cursor?: string;
  }): Promise<TerritorialAuditPage>;
}
