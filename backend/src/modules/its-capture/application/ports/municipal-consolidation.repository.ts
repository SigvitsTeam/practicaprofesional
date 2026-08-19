import type {
  MunicipalConsolidationSummary,
  MunicipalConsolidationContext,
  MunicipalReportTerritory,
} from '../../domain/municipal-consolidation';

export abstract class MunicipalConsolidationRepository {
  abstract getContext(municipalityIds?: readonly string[]): Promise<MunicipalConsolidationContext>;
  abstract prepare(input: {
    municipalityId: string;
    year: number;
    month: number;
    userId: string;
    comment?: string;
  }): Promise<MunicipalConsolidationSummary>;
  abstract findTerritory(reportId: string): Promise<MunicipalReportTerritory | undefined>;
  abstract submitToRegion(
    reportId: string,
    userId: string,
    comment?: string,
  ): Promise<MunicipalConsolidationSummary>;
  abstract returnToMunicipality(
    reportId: string,
    userId: string,
    comment: string,
  ): Promise<MunicipalConsolidationSummary>;
  abstract approveRegionally(
    reportId: string,
    userId: string,
    comment?: string,
  ): Promise<MunicipalConsolidationSummary>;
  abstract getCurrent(input: {
    municipalityId: string;
    year: number;
    month: number;
  }): Promise<MunicipalConsolidationSummary | undefined>;
  abstract listRegionalInbox(input: {
    regionIds?: readonly string[];
    year: number;
    month: number;
  }): Promise<MunicipalConsolidationSummary[]>;
}
