import type { MonthlyReportSource } from '../../../its-capture/domain/its-monthly-report';
import type {
  MunicipalConsolidatedExportParameters,
  ResolvedMunicipalExportRange,
} from '../../domain/export-job';

export abstract class MunicipalIts2ExportRepository {
  abstract resolveRange(
    parameters: MunicipalConsolidatedExportParameters,
  ): Promise<ResolvedMunicipalExportRange>;

  abstract getReportSource(input: {
    municipalityId: string;
    range: ResolvedMunicipalExportRange;
  }): Promise<MonthlyReportSource>;
}
