import type {
  Its2ReportSummary,
  PrepareIts2ReportInput,
  ReportTerritory,
} from '../../domain/its-report-workflow';

export abstract class ItsReportWorkflowRepository {
  abstract prepare(input: PrepareIts2ReportInput): Promise<Its2ReportSummary>;
  abstract findTerritory(reportId: string): Promise<ReportTerritory | undefined>;
  abstract submit(reportId: string, userId: string): Promise<Its2ReportSummary>;
  abstract returnToFacility(
    reportId: string,
    userId: string,
    comment: string,
  ): Promise<Its2ReportSummary>;
  abstract approveMunicipally(
    reportId: string,
    userId: string,
    comment?: string,
  ): Promise<Its2ReportSummary>;
  abstract getCurrent(input: {
    facilityId: string;
    year: number;
    month: number;
  }): Promise<Its2ReportSummary | undefined>;
  abstract listMunicipalInbox(input: {
    municipalityIds: readonly string[];
    year: number;
    month: number;
  }): Promise<Its2ReportSummary[]>;
}
