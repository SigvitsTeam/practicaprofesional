import type {
  RegionalConsolidationContext,
  RegionalConsolidationSummary,
} from '../../domain/regional-consolidation';

export abstract class RegionalConsolidationRepository {
  abstract getContext(regionIds?: readonly string[]): Promise<RegionalConsolidationContext>;
  abstract prepare(input: {
    regionId: string;
    year: number;
    month: number;
    userId: string;
    comment?: string;
  }): Promise<RegionalConsolidationSummary>;
  abstract findRegionId(reportId: string): Promise<string | undefined>;
  abstract submitToCentral(
    reportId: string,
    userId: string,
    comment?: string,
  ): Promise<RegionalConsolidationSummary>;
  abstract returnToRegion(
    reportId: string,
    userId: string,
    comment: string,
  ): Promise<RegionalConsolidationSummary>;
  abstract approveCentrally(
    reportId: string,
    userId: string,
    comment?: string,
  ): Promise<RegionalConsolidationSummary>;
  abstract getCurrent(input: {
    regionId: string;
    year: number;
    month: number;
  }): Promise<RegionalConsolidationSummary | undefined>;
  abstract listCentralInbox(input: {
    year: number;
    month: number;
  }): Promise<RegionalConsolidationSummary[]>;
}
