import { Injectable } from '@nestjs/common';
import {
  RoleCode,
  type AuthorizationSubject,
} from '../../authorization/domain/authorization.types';
import {
  MunicipalConsolidationAccessError,
  MunicipalConsolidationNotFoundError,
  type MunicipalConsolidationSummary,
  type MunicipalConsolidationContext,
  type MunicipalPreliminaryReport,
  type MunicipalPreliminaryReportSource,
  type MunicipalReportTerritory,
} from '../domain/municipal-consolidation';
import { MunicipalConsolidationRepository } from './ports/municipal-consolidation.repository';
import { TerritorialAnalyticsUseCase } from './territorial-analytics.use-case';

const PRELIMINARY_NOTICE =
  'Datos preliminares acumulados automáticamente desde ITS 1; pendientes de depuración y aprobación institucional.';

@Injectable()
export class MunicipalConsolidationUseCase {
  constructor(
    private readonly repository: MunicipalConsolidationRepository,
    private readonly territorialAnalytics: TerritorialAnalyticsUseCase,
  ) {}

  getContext(subject: AuthorizationSubject): Promise<MunicipalConsolidationContext> {
    this.requireMunicipalOperator(subject, 'its2:municipal:prepare');
    const municipalityIds = subject.territory.municipalityGrantIds ?? [];
    if (!municipalityIds.length)
      throw new MunicipalConsolidationAccessError(
        'La operación requiere una asignación municipal directa.',
      );
    return this.repository.getContext(municipalityIds);
  }

  prepare(
    input: { municipalityId: string; year: number; month: number; comment?: string },
    subject: AuthorizationSubject,
  ): Promise<MunicipalConsolidationSummary> {
    this.requireMunicipalOperator(subject, 'its2:municipal:prepare');
    this.requireDirectMunicipality(input.municipalityId, subject);
    return this.repository.prepare({ ...input, userId: subject.userId });
  }

  async getCurrent(
    municipalityId: string,
    year: number,
    month: number,
    subject: AuthorizationSubject,
  ): Promise<MunicipalConsolidationSummary | undefined> {
    this.requireMunicipalFlowCandidate(municipalityId, subject);
    const report = await this.repository.getCurrent({ municipalityId, year, month });
    if (report) {
      this.requireMunicipalFlow(municipalityId, report.regionId, subject);
      return report;
    }

    if (this.isRegionalFlow(subject)) {
      const source = await this.repository.getPreliminaryReportSource({
        municipalityId,
        year,
        month,
      });
      this.requireMunicipalFlow(municipalityId, source?.municipality.regionId, subject);
    }
    return undefined;
  }

  async getPreliminaryReportSource(
    municipalityId: string,
    year: number,
    month: number,
    subject: AuthorizationSubject,
  ): Promise<MunicipalPreliminaryReportSource> {
    this.requireMunicipalFlowCandidate(municipalityId, subject);
    const source = await this.repository.getPreliminaryReportSource({
      municipalityId,
      year,
      month,
    });
    if (!source)
      throw new MunicipalConsolidationNotFoundError(
        'El municipio solicitado no está activo ni tiene atenciones ITS-1 activas en el período.',
      );
    this.requireMunicipalFlow(municipalityId, source.municipality.regionId, subject);
    return source;
  }

  async getPreliminaryReport(
    municipalityId: string,
    year: number,
    month: number,
    subject: AuthorizationSubject,
  ): Promise<MunicipalPreliminaryReport> {
    const source = await this.getPreliminaryReportSource(municipalityId, year, month, subject);
    const analyticsSubject: AuthorizationSubject = {
      ...subject,
      territory: {
        ...subject.territory,
        municipalityIds: [...new Set([...subject.territory.municipalityIds, municipalityId])],
      },
    };
    const analytics = await this.territorialAnalytics.execute(
      { level: 'ESTABLECIMIENTO', municipalityId, year, month },
      analyticsSubject,
    );
    return {
      municipality: source.municipality,
      year,
      month,
      dataStatus: 'PRELIMINAR',
      dataSource: 'ITS1',
      notice: PRELIMINARY_NOTICE,
      privacy: analytics.privacy,
      rows: analytics.rows,
    };
  }

  listRegionalInbox(
    year: number,
    month: number,
    subject: AuthorizationSubject,
  ): Promise<MunicipalConsolidationSummary[]> {
    this.requireRegionalReviewer(subject);
    const regionIds = subject.territory.regionGrantIds ?? [];
    if (!regionIds.length)
      throw new MunicipalConsolidationAccessError(
        'La bandeja requiere una asignación regional directa.',
      );
    return this.repository.listRegionalInbox({
      regionIds,
      year,
      month,
    });
  }

  async submitToRegion(
    reportId: string,
    comment: string | undefined,
    subject: AuthorizationSubject,
  ): Promise<MunicipalConsolidationSummary> {
    this.requireMunicipalOperator(subject, 'its2:municipal:submit');
    const territory = await this.requiredTerritory(reportId);
    this.requireDirectMunicipality(territory.municipalityId, subject);
    return this.repository.submitToRegion(reportId, subject.userId, comment);
  }

  async returnToMunicipality(
    reportId: string,
    comment: string,
    subject: AuthorizationSubject,
  ): Promise<MunicipalConsolidationSummary> {
    this.requireRegionalReviewer(subject);
    const territory = await this.requiredTerritory(reportId);
    this.requireDirectRegion(territory.regionId, subject);
    return this.repository.returnToMunicipality(reportId, subject.userId, comment);
  }

  async approveRegionally(
    reportId: string,
    comment: string | undefined,
    subject: AuthorizationSubject,
  ): Promise<MunicipalConsolidationSummary> {
    this.requireRegionalReviewer(subject);
    const territory = await this.requiredTerritory(reportId);
    this.requireDirectRegion(territory.regionId, subject);
    return this.repository.approveRegionally(reportId, subject.userId, comment);
  }

  private requireMunicipalOperator(subject: AuthorizationSubject, permission: string): void {
    this.rejectAdministrativeRole(subject);
    if (
      !subject.roles.includes(RoleCode.MunicipalCoordinator) ||
      !this.hasPermission(subject, permission)
    )
      throw new MunicipalConsolidationAccessError(
        'La operación requiere capacidad de flujo municipal.',
      );
  }

  private requireDirectMunicipality(municipalityId: string, subject: AuthorizationSubject): void {
    if (!(subject.territory.municipalityGrantIds ?? []).includes(municipalityId))
      throw new MunicipalConsolidationAccessError(
        'El consolidado está fuera de la asignación municipal directa.',
      );
  }

  private requireRegionalReviewer(subject: AuthorizationSubject): void {
    this.rejectAdministrativeRole(subject);
    if (!this.isRegionalFlow(subject))
      throw new MunicipalConsolidationAccessError(
        'La operación requiere capacidad de revisión regional.',
      );
  }

  private requireDirectRegion(regionId: string, subject: AuthorizationSubject): void {
    if (!(subject.territory.regionGrantIds ?? []).includes(regionId))
      throw new MunicipalConsolidationAccessError(
        'El consolidado está fuera de la asignación regional directa.',
      );
  }

  private requireMunicipalFlowCandidate(
    municipalityId: string,
    subject: AuthorizationSubject,
  ): void {
    this.rejectAdministrativeRole(subject);
    if (!this.hasPermission(subject, 'its2:reports:read'))
      throw new MunicipalConsolidationAccessError(
        'La consulta requiere permiso de lectura de reportes ITS-2.',
      );

    if (this.isCentralFlow(subject)) return;
    if (
      subject.roles.includes(RoleCode.MunicipalCoordinator) &&
      this.hasPermission(subject, 'its2:municipal:prepare') &&
      (subject.territory.municipalityGrantIds ?? []).includes(municipalityId)
    )
      return;
    if (this.isRegionalFlow(subject) && (subject.territory.regionGrantIds?.length ?? 0) > 0) return;
    throw new MunicipalConsolidationAccessError(
      'La consulta requiere una asignación directa y capacidad de flujo municipal, regional o central.',
    );
  }

  private requireMunicipalFlow(
    municipalityId: string,
    regionId: string | undefined,
    subject: AuthorizationSubject,
  ): void {
    this.requireMunicipalFlowCandidate(municipalityId, subject);
    if (this.isCentralFlow(subject)) return;
    if (
      subject.roles.includes(RoleCode.MunicipalCoordinator) &&
      (subject.territory.municipalityGrantIds ?? []).includes(municipalityId)
    )
      return;
    if (
      this.isRegionalFlow(subject) &&
      regionId &&
      (subject.territory.regionGrantIds ?? []).includes(regionId)
    )
      return;
    throw new MunicipalConsolidationAccessError(
      'El consolidado está fuera del alcance operativo asignado.',
    );
  }

  private isRegionalFlow(subject: AuthorizationSubject): boolean {
    return (
      subject.roles.includes(RoleCode.RegionalAdmin) &&
      this.hasPermission(subject, 'its2:regional:review')
    );
  }

  private isCentralFlow(subject: AuthorizationSubject): boolean {
    return (
      subject.roles.includes(RoleCode.CentralAdmin) &&
      this.hasPermission(subject, 'its2:central:review') &&
      subject.territory.national
    );
  }

  private rejectAdministrativeRole(subject: AuthorizationSubject): void {
    if (
      subject.roles.includes(RoleCode.SuperAdmin) ||
      subject.roles.includes(RoleCode.RegionalSuperAdmin)
    )
      throw new MunicipalConsolidationAccessError(
        'Los perfiles superadmin tienen alcance administrativo y no participan en el flujo ITS-2.',
      );
  }

  private hasPermission(subject: AuthorizationSubject, permission: string): boolean {
    return subject.permissions.includes(permission) || subject.permissions.includes('*');
  }

  private async requiredTerritory(reportId: string): Promise<MunicipalReportTerritory> {
    const territory = await this.repository.findTerritory(reportId);
    if (!territory)
      throw new MunicipalConsolidationNotFoundError('El consolidado municipal no existe.');
    return territory;
  }
}
