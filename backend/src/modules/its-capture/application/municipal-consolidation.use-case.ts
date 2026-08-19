import { Injectable } from '@nestjs/common';
import type { AuthorizationSubject } from '../../authorization/domain/authorization.types';
import {
  MunicipalConsolidationAccessError,
  MunicipalConsolidationNotFoundError,
  type MunicipalConsolidationSummary,
  type MunicipalConsolidationContext,
  type MunicipalReportTerritory,
} from '../domain/municipal-consolidation';
import { MunicipalConsolidationRepository } from './ports/municipal-consolidation.repository';

@Injectable()
export class MunicipalConsolidationUseCase {
  constructor(private readonly repository: MunicipalConsolidationRepository) {}

  getContext(subject: AuthorizationSubject): Promise<MunicipalConsolidationContext> {
    return this.repository.getContext(
      subject.territory.national ? undefined : subject.territory.municipalityIds,
    );
  }

  prepare(
    input: { municipalityId: string; year: number; month: number; comment?: string },
    subject: AuthorizationSubject,
  ): Promise<MunicipalConsolidationSummary> {
    this.requireMunicipality(input.municipalityId, subject);
    return this.repository.prepare({ ...input, userId: subject.userId });
  }

  getCurrent(
    municipalityId: string,
    year: number,
    month: number,
    subject: AuthorizationSubject,
  ): Promise<MunicipalConsolidationSummary | undefined> {
    this.requireMunicipality(municipalityId, subject);
    return this.repository.getCurrent({ municipalityId, year, month });
  }

  listRegionalInbox(
    year: number,
    month: number,
    subject: AuthorizationSubject,
  ): Promise<MunicipalConsolidationSummary[]> {
    return this.repository.listRegionalInbox({
      regionIds: subject.territory.national ? undefined : subject.territory.regionIds,
      year,
      month,
    });
  }

  async submitToRegion(
    reportId: string,
    comment: string | undefined,
    subject: AuthorizationSubject,
  ): Promise<MunicipalConsolidationSummary> {
    const territory = await this.requiredTerritory(reportId);
    this.requireMunicipality(territory.municipalityId, subject);
    return this.repository.submitToRegion(reportId, subject.userId, comment);
  }

  async returnToMunicipality(
    reportId: string,
    comment: string,
    subject: AuthorizationSubject,
  ): Promise<MunicipalConsolidationSummary> {
    const territory = await this.requiredTerritory(reportId);
    this.requireRegion(territory.regionId, subject);
    return this.repository.returnToMunicipality(reportId, subject.userId, comment);
  }

  async approveRegionally(
    reportId: string,
    comment: string | undefined,
    subject: AuthorizationSubject,
  ): Promise<MunicipalConsolidationSummary> {
    const territory = await this.requiredTerritory(reportId);
    this.requireRegion(territory.regionId, subject);
    return this.repository.approveRegionally(reportId, subject.userId, comment);
  }

  private requireMunicipality(municipalityId: string, subject: AuthorizationSubject): void {
    if (!subject.territory.national && !subject.territory.municipalityIds.includes(municipalityId))
      throw new MunicipalConsolidationAccessError(
        'El consolidado está fuera del municipio autorizado.',
      );
  }

  private requireRegion(regionId: string, subject: AuthorizationSubject): void {
    if (!subject.territory.national && !subject.territory.regionIds.includes(regionId))
      throw new MunicipalConsolidationAccessError(
        'El consolidado está fuera de la región autorizada.',
      );
  }

  private async requiredTerritory(reportId: string): Promise<MunicipalReportTerritory> {
    const territory = await this.repository.findTerritory(reportId);
    if (!territory)
      throw new MunicipalConsolidationNotFoundError('El consolidado municipal no existe.');
    return territory;
  }
}
