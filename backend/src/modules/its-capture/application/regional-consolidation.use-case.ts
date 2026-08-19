import { Injectable } from '@nestjs/common';
import type { AuthorizationSubject } from '../../authorization/domain/authorization.types';
import {
  RegionalConsolidationAccessError,
  RegionalConsolidationNotFoundError,
  type RegionalConsolidationContext,
  type RegionalConsolidationSummary,
} from '../domain/regional-consolidation';
import { RegionalConsolidationRepository } from './ports/regional-consolidation.repository';

@Injectable()
export class RegionalConsolidationUseCase {
  constructor(private readonly repository: RegionalConsolidationRepository) {}

  getContext(subject: AuthorizationSubject): Promise<RegionalConsolidationContext> {
    return this.repository.getContext(
      subject.territory.national ? undefined : subject.territory.regionIds,
    );
  }

  prepare(
    input: { regionId: string; year: number; month: number; comment?: string },
    subject: AuthorizationSubject,
  ): Promise<RegionalConsolidationSummary> {
    this.requireRegion(input.regionId, subject);
    return this.repository.prepare({ ...input, userId: subject.userId });
  }

  getCurrent(
    regionId: string,
    year: number,
    month: number,
    subject: AuthorizationSubject,
  ): Promise<RegionalConsolidationSummary | undefined> {
    this.requireRegion(regionId, subject);
    return this.repository.getCurrent({ regionId, year, month });
  }

  listCentralInbox(
    year: number,
    month: number,
    subject: AuthorizationSubject,
  ): Promise<RegionalConsolidationSummary[]> {
    this.requireNational(subject);
    return this.repository.listCentralInbox({ year, month });
  }

  async submitToCentral(
    reportId: string,
    comment: string | undefined,
    subject: AuthorizationSubject,
  ): Promise<RegionalConsolidationSummary> {
    const regionId = await this.requiredRegionId(reportId);
    this.requireRegion(regionId, subject);
    return this.repository.submitToCentral(reportId, subject.userId, comment);
  }

  async returnToRegion(
    reportId: string,
    comment: string,
    subject: AuthorizationSubject,
  ): Promise<RegionalConsolidationSummary> {
    this.requireNational(subject);
    await this.requiredRegionId(reportId);
    return this.repository.returnToRegion(reportId, subject.userId, comment);
  }

  async approveCentrally(
    reportId: string,
    comment: string | undefined,
    subject: AuthorizationSubject,
  ): Promise<RegionalConsolidationSummary> {
    this.requireNational(subject);
    await this.requiredRegionId(reportId);
    return this.repository.approveCentrally(reportId, subject.userId, comment);
  }

  private requireRegion(regionId: string, subject: AuthorizationSubject): void {
    if (!subject.territory.national && !subject.territory.regionIds.includes(regionId))
      throw new RegionalConsolidationAccessError(
        'El consolidado está fuera de la región autorizada.',
      );
  }

  private requireNational(subject: AuthorizationSubject): void {
    if (!subject.territory.national)
      throw new RegionalConsolidationAccessError('La operación requiere alcance nacional.');
  }

  private async requiredRegionId(reportId: string): Promise<string> {
    const regionId = await this.repository.findRegionId(reportId);
    if (!regionId)
      throw new RegionalConsolidationNotFoundError('El consolidado regional no existe.');
    return regionId;
  }
}
