import { Injectable } from '@nestjs/common';
import {
  RoleCode,
  type AuthorizationSubject,
} from '../../authorization/domain/authorization.types';
import {
  InvalidTerritorialAnalyticsQueryError,
  TerritorialAnalyticsScopeDeniedError,
  type TerritorialAnalyticsQuery,
  type TerritorialAnalyticsResult,
} from '../domain/territorial-analytics';
import { TerritorialAnalyticsRepository } from './ports/territorial-analytics.repository';
import { TerritorialAnalyticsPrivacyPolicy } from './territorial-analytics-privacy.policy';

@Injectable()
export class TerritorialAnalyticsUseCase {
  constructor(
    private readonly repository: TerritorialAnalyticsRepository,
    private readonly privacy: TerritorialAnalyticsPrivacyPolicy,
  ) {}

  async execute(
    input: TerritorialAnalyticsQuery,
    subject: AuthorizationSubject,
  ): Promise<TerritorialAnalyticsResult> {
    if (
      subject.roles.some(
        (role) => role === RoleCode.SuperAdmin || role === RoleCode.RegionalSuperAdmin,
      )
    )
      throw new TerritorialAnalyticsScopeDeniedError(
        'Los perfiles superadmin tienen alcance administrativo y no consultan datos de casos.',
      );
    if (!Number.isInteger(input.year) || input.year < 2020 || input.year > 2100)
      throw new InvalidTerritorialAnalyticsQueryError('El año solicitado no es válido.');
    if (!Number.isInteger(input.month) || input.month < 1 || input.month > 12)
      throw new InvalidTerritorialAnalyticsQueryError('El mes solicitado no es válido.');
    if (input.level === 'REGION' && !subject.territory.national)
      throw new InvalidTerritorialAnalyticsQueryError(
        'El nivel regional agregado requiere alcance nacional.',
      );
    if (
      input.level === 'MUNICIPIO' &&
      !subject.territory.national &&
      !(subject.territory.regionGrantIds?.length ?? 0) &&
      !(subject.territory.municipalityScopeIds ?? subject.territory.municipalityGrantIds ?? [])
        .length
    )
      throw new TerritorialAnalyticsScopeDeniedError(
        'El nivel municipal agregado requiere una asignación municipal o regional directa.',
      );
    this.validateParent(input, subject);
    const rows = await this.repository.list({
      ...input,
      scope: subject.territory,
    });
    const protectedRows = this.privacy.protect(rows);
    return {
      ...input,
      dataStatus:
        rows.length > 0 && rows.every((row) => row.dataStatus === 'OFICIAL')
          ? 'OFICIAL'
          : 'PRELIMINAR',
      dataSource: 'ITS1',
      notice:
        rows.length > 0 && rows.every((row) => row.dataStatus === 'OFICIAL')
          ? 'Datos oficiales del período cerrado.'
          : 'Datos preliminares acumulados automáticamente desde ITS 1; están pendientes de depuración y aprobación institucional.',
      privacy: {
        smallCountThreshold: protectedRows.smallCountThreshold,
        suppressedValue: protectedRows.suppressedValue,
      },
      rows: protectedRows.rows,
    };
  }

  private validateParent(input: TerritorialAnalyticsQuery, subject: AuthorizationSubject): void {
    if (input.level === 'REGION' && (input.regionId || input.municipalityId))
      throw new InvalidTerritorialAnalyticsQueryError(
        'El nivel regional no admite un territorio padre.',
      );
    if (input.level === 'MUNICIPIO' && input.municipalityId)
      throw new InvalidTerritorialAnalyticsQueryError(
        'El nivel municipal sólo admite regionId como territorio padre.',
      );
    if (input.level === 'ESTABLECIMIENTO' && input.regionId)
      throw new InvalidTerritorialAnalyticsQueryError(
        'El nivel de establecimiento sólo admite municipalityId como territorio padre.',
      );
    if (
      input.regionId &&
      !subject.territory.national &&
      !subject.territory.regionIds.includes(input.regionId)
    )
      throw new TerritorialAnalyticsScopeDeniedError(
        'La región solicitada está fuera del alcance autorizado.',
      );
    if (
      input.municipalityId &&
      !subject.territory.national &&
      !subject.territory.municipalityIds.includes(input.municipalityId) &&
      !(subject.territory.regionGrantIds?.length ?? 0)
    )
      throw new TerritorialAnalyticsScopeDeniedError(
        'El municipio solicitado está fuera del alcance autorizado.',
      );
  }
}
