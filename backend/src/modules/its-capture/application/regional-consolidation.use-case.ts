import { Injectable } from '@nestjs/common';
import {
  RoleCode,
  type AuthorizationSubject,
} from '../../authorization/domain/authorization.types';
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
    this.requireRegionalOperator(subject, 'its2:regional:prepare');
    const regionIds = subject.territory.regionGrantIds ?? [];
    if (!regionIds.length)
      throw new RegionalConsolidationAccessError(
        'La operación requiere una asignación regional directa.',
      );
    return this.repository.getContext(regionIds);
  }

  prepare(
    input: { regionId: string; year: number; month: number; comment?: string },
    subject: AuthorizationSubject,
  ): Promise<RegionalConsolidationSummary> {
    this.requireRegionalOperator(subject, 'its2:regional:prepare');
    this.requireDirectRegion(input.regionId, subject);
    return this.repository.prepare({ ...input, userId: subject.userId });
  }

  getCurrent(
    regionId: string,
    year: number,
    month: number,
    subject: AuthorizationSubject,
  ): Promise<RegionalConsolidationSummary | undefined> {
    this.requireRegionalRead(regionId, subject);
    return this.repository.getCurrent({ regionId, year, month });
  }

  listCentralInbox(
    year: number,
    month: number,
    subject: AuthorizationSubject,
  ): Promise<RegionalConsolidationSummary[]> {
    this.requireCentralReviewer(subject);
    return this.repository.listCentralInbox({ year, month });
  }

  async submitToCentral(
    reportId: string,
    comment: string | undefined,
    subject: AuthorizationSubject,
  ): Promise<RegionalConsolidationSummary> {
    this.requireRegionalOperator(subject, 'its2:regional:submit');
    const regionId = await this.requiredRegionId(reportId);
    this.requireDirectRegion(regionId, subject);
    return this.repository.submitToCentral(reportId, subject.userId, comment);
  }

  async returnToRegion(
    reportId: string,
    comment: string,
    subject: AuthorizationSubject,
  ): Promise<RegionalConsolidationSummary> {
    this.requireCentralReviewer(subject);
    await this.requiredRegionId(reportId);
    return this.repository.returnToRegion(reportId, subject.userId, comment);
  }

  async approveCentrally(
    reportId: string,
    comment: string | undefined,
    subject: AuthorizationSubject,
  ): Promise<RegionalConsolidationSummary> {
    this.requireCentralReviewer(subject);
    await this.requiredRegionId(reportId);
    return this.repository.approveCentrally(reportId, subject.userId, comment);
  }

  private requireRegionalRead(regionId: string, subject: AuthorizationSubject): void {
    this.rejectAdministrativeRole(subject);
    if (
      subject.roles.includes(RoleCode.CentralAdmin) &&
      subject.territory.national &&
      this.hasPermission(subject, 'its2:reports:read') &&
      this.hasPermission(subject, 'its2:central:review')
    )
      return;

    this.requireRegionalOperator(subject, 'its2:reports:read');
    this.requireDirectRegion(regionId, subject);
  }

  private requireRegionalOperator(subject: AuthorizationSubject, permission: string): void {
    this.rejectAdministrativeRole(subject);
    if (!subject.roles.includes(RoleCode.RegionalAdmin) || !this.hasPermission(subject, permission))
      throw new RegionalConsolidationAccessError(
        'La operación requiere capacidad de flujo regional.',
      );
  }

  private requireDirectRegion(regionId: string, subject: AuthorizationSubject): void {
    if (!(subject.territory.regionGrantIds ?? []).includes(regionId))
      throw new RegionalConsolidationAccessError(
        'El consolidado está fuera de la asignación regional directa.',
      );
  }

  private requireCentralReviewer(subject: AuthorizationSubject): void {
    this.rejectAdministrativeRole(subject);
    if (
      !subject.territory.national ||
      !subject.roles.includes(RoleCode.CentralAdmin) ||
      !this.hasPermission(subject, 'its2:central:review')
    )
      throw new RegionalConsolidationAccessError(
        'La operación requiere capacidad de revisión central y alcance nacional.',
      );
  }

  private rejectAdministrativeRole(subject: AuthorizationSubject): void {
    if (
      subject.roles.includes(RoleCode.SuperAdmin) ||
      subject.roles.includes(RoleCode.RegionalSuperAdmin)
    )
      throw new RegionalConsolidationAccessError(
        'Los perfiles superadmin tienen alcance administrativo y no participan en el flujo ITS-2.',
      );
  }

  private hasPermission(subject: AuthorizationSubject, permission: string): boolean {
    return subject.permissions.includes(permission) || subject.permissions.includes('*');
  }

  private async requiredRegionId(reportId: string): Promise<string> {
    const regionId = await this.repository.findRegionId(reportId);
    if (!regionId)
      throw new RegionalConsolidationNotFoundError('El consolidado regional no existe.');
    return regionId;
  }
}
