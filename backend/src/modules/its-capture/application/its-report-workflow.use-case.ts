import { Injectable } from '@nestjs/common';
import type { AuthorizationSubject } from '../../authorization/domain/authorization.types';
import {
  ItsReportAccessError,
  ItsReportNotFoundError,
  type Its2ReportSummary,
  type PrepareIts2ReportInput,
} from '../domain/its-report-workflow';
import { ItsReportWorkflowRepository } from './ports/its-report-workflow.repository';

@Injectable()
export class ItsReportWorkflowUseCase {
  constructor(private readonly repository: ItsReportWorkflowRepository) {}

  prepare(
    input: Omit<PrepareIts2ReportInput, 'userId'>,
    subject: AuthorizationSubject,
  ): Promise<Its2ReportSummary> {
    if (!subject.territory.facilityIds.includes(input.facilityId))
      throw new ItsReportAccessError('El establecimiento está fuera del alcance autorizado.');
    return this.repository.prepare({ ...input, userId: subject.userId });
  }

  async submit(reportId: string, subject: AuthorizationSubject): Promise<Its2ReportSummary> {
    const territory = await this.requiredTerritory(reportId);
    if (!territory.facilityId || !subject.territory.facilityIds.includes(territory.facilityId))
      throw new ItsReportAccessError('El reporte está fuera del alcance autorizado.');
    return this.repository.submit(reportId, subject.userId);
  }

  async returnToFacility(
    reportId: string,
    comment: string,
    subject: AuthorizationSubject,
  ): Promise<Its2ReportSummary> {
    const territory = await this.requiredTerritory(reportId);
    if (
      !territory.municipalityId ||
      !subject.territory.municipalityIds.includes(territory.municipalityId)
    )
      throw new ItsReportAccessError('El reporte está fuera del municipio autorizado.');
    return this.repository.returnToFacility(reportId, subject.userId, comment);
  }

  async approveMunicipally(
    reportId: string,
    comment: string | undefined,
    subject: AuthorizationSubject,
  ): Promise<Its2ReportSummary> {
    const territory = await this.requiredTerritory(reportId);
    if (
      !territory.municipalityId ||
      !subject.territory.municipalityIds.includes(territory.municipalityId)
    )
      throw new ItsReportAccessError('El reporte está fuera del municipio autorizado.');
    return this.repository.approveMunicipally(reportId, subject.userId, comment);
  }

  getCurrent(
    facilityId: string,
    year: number,
    month: number,
    subject: AuthorizationSubject,
  ): Promise<Its2ReportSummary | undefined> {
    if (!subject.territory.facilityIds.includes(facilityId))
      throw new ItsReportAccessError('El establecimiento está fuera del alcance autorizado.');
    return this.repository.getCurrent({ facilityId, year, month });
  }

  listMunicipalInbox(
    year: number,
    month: number,
    subject: AuthorizationSubject,
  ): Promise<Its2ReportSummary[]> {
    return this.repository.listMunicipalInbox({
      municipalityIds: subject.territory.municipalityIds,
      year,
      month,
    });
  }

  private async requiredTerritory(reportId: string): Promise<{
    facilityId?: string;
    municipalityId?: string;
  }> {
    const territory = await this.repository.findTerritory(reportId);
    if (!territory) throw new ItsReportNotFoundError('El reporte ITS-2 no existe.');
    return territory;
  }
}
