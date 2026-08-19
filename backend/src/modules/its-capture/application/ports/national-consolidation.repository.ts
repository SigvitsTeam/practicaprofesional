import type {
  NationalConsolidationContext,
  NationalConsolidationSummary,
} from '../../domain/national-consolidation';

export abstract class NationalConsolidationRepository {
  abstract getContext(): Promise<NationalConsolidationContext>;
  abstract prepare(input: {
    year: number;
    month: number;
    userId: string;
    comment?: string;
  }): Promise<NationalConsolidationSummary>;
  abstract getCurrent(input: {
    year: number;
    month: number;
  }): Promise<NationalConsolidationSummary | undefined>;
  abstract finalize(
    reportId: string,
    userId: string,
    comment?: string,
  ): Promise<NationalConsolidationSummary>;
  abstract close(
    reportId: string,
    userId: string,
    reason: string,
  ): Promise<NationalConsolidationSummary>;
  abstract reopen(
    reportId: string,
    userId: string,
    reason: string,
  ): Promise<NationalConsolidationSummary>;
}
