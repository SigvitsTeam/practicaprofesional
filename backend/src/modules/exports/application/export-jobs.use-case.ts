import { Injectable } from '@nestjs/common';
import {
  RoleCode,
  type AuthorizationSubject,
} from '../../authorization/domain/authorization.types';
import {
  ExportJobScopeError,
  InvalidExportJobError,
  type AnnualComparisonIndicator,
  type AnnualComparisonParameters,
  type CreateExportJobInput,
  type ExportJob,
} from '../domain/export-job';
import { ExportJobRepository } from './ports/export-job.repository';
import { defaultExportTerritory, isExportScopeAllowed } from './export-scope.policy';

@Injectable()
export class ExportJobsUseCase {
  constructor(private readonly repository: ExportJobRepository) {}

  listOwn(subject: AuthorizationSubject): Promise<ExportJob[]> {
    return this.repository.listOwn(subject.userId, 50);
  }

  create(
    input: Omit<CreateExportJobInput, 'requestedByUserId'>,
    subject: AuthorizationSubject,
  ): Promise<ExportJob> {
    if (
      ![
        'TERRITORIAL_SUMMARY',
        'ITS2_MONTHLY',
        'MUNICIPAL_CONSOLIDATED',
        'REGIONAL_CONSOLIDATED',
        'NATIONAL_CONSOLIDATED',
        'ITS1_REGISTER',
        'ANNUAL_COMPARISON',
      ].includes(input.reportType)
    )
      throw new InvalidExportJobError('El tipo de reporte no es válido.');
    const requiredScope = {
      ITS2_MONTHLY: 'ESTABLECIMIENTO',
      MUNICIPAL_CONSOLIDATED: 'MUNICIPIO',
      REGIONAL_CONSOLIDATED: 'REGION',
      NATIONAL_CONSOLIDATED: 'NACIONAL',
      ITS1_REGISTER: 'ESTABLECIMIENTO',
    }[input.reportType];
    if (requiredScope && input.scopeLevel !== requiredScope)
      throw new InvalidExportJobError('El tipo de reporte no corresponde al alcance solicitado.');
    if (input.year < 2000 || input.year > 2100 || input.month < 1 || input.month > 12)
      throw new InvalidExportJobError('El período solicitado no es válido.');
    const parameters =
      input.reportType === 'ANNUAL_COMPARISON'
        ? this.validateAnnualParameters(input.parameters)
        : null;
    if (input.reportType !== 'ANNUAL_COMPARISON' && input.parameters)
      throw new InvalidExportJobError('Este tipo de reporte no admite parámetros adicionales.');
    const territoryId = input.territoryId ?? defaultExportTerritory(input.scopeLevel, subject);
    if (!isExportScopeAllowed(input.scopeLevel, territoryId, subject))
      throw new ExportJobScopeError(
        'La exportación está fuera del alcance territorial asignado directamente.',
      );
    return this.repository.create({
      ...input,
      parameters,
      territoryId,
      requestedByUserId: subject.userId,
    });
  }

  createIts1(
    input: {
      idempotencyKey: string;
      format: 'XLSX' | 'PDF';
      facilityId: string;
      year: number;
      month: number;
      requestId: string;
    },
    subject: AuthorizationSubject,
  ): Promise<ExportJob> {
    const directlyAssignedManager =
      subject.roles.includes(RoleCode.FacilityManager) &&
      (subject.territory.facilityGrantIds ?? []).includes(input.facilityId);
    const municipalOrFacilityDataEntry =
      subject.roles.includes(RoleCode.CoordinationDataEntry) &&
      subject.territory.facilityIds.includes(input.facilityId);
    if (!directlyAssignedManager && !municipalOrFacilityDataEntry)
      throw new ExportJobScopeError(
        'La exportación ITS 1 requiere una asignación operativa al establecimiento.',
      );
    return this.create(
      {
        idempotencyKey: input.idempotencyKey,
        reportType: 'ITS1_REGISTER',
        format: input.format,
        scopeLevel: 'ESTABLECIMIENTO',
        territoryId: input.facilityId,
        year: input.year,
        month: input.month,
        requestId: input.requestId,
      },
      subject,
    );
  }

  private validateAnnualParameters(
    value: Record<string, unknown> | null | undefined,
  ): AnnualComparisonParameters {
    if (!value) throw new InvalidExportJobError('La comparación anual requiere parámetros.');
    const allowedKeys = new Set([
      'dimension',
      'rangeAStart',
      'rangeAEnd',
      'rangeBStart',
      'rangeBEnd',
      'indicatorA',
      'indicatorB',
    ]);
    if (Object.keys(value).some((key) => !allowedKeys.has(key)))
      throw new InvalidExportJobError('La comparación anual contiene parámetros no admitidos.');
    const dimension = value.dimension;
    if (dimension !== 'periods' && dimension !== 'indicators')
      throw new InvalidExportJobError('La dimensión de comparación no es válida.');
    const monthPattern = /^(20\d{2}|2100)-(0[1-9]|1[0-2])$/;
    const rangeAStart = value.rangeAStart;
    const rangeAEnd = value.rangeAEnd;
    const rangeBStart = value.rangeBStart;
    const rangeBEnd = value.rangeBEnd;
    if (
      typeof rangeAStart !== 'string' ||
      typeof rangeAEnd !== 'string' ||
      typeof rangeBStart !== 'string' ||
      typeof rangeBEnd !== 'string' ||
      !monthPattern.test(rangeAStart) ||
      !monthPattern.test(rangeAEnd) ||
      !monthPattern.test(rangeBStart) ||
      !monthPattern.test(rangeBEnd) ||
      rangeAStart > rangeAEnd ||
      rangeBStart > rangeBEnd
    )
      throw new InvalidExportJobError('Los rangos de comparación no son válidos.');
    if (
      this.monthCount(rangeAStart, rangeAEnd) > 24 ||
      this.monthCount(rangeBStart, rangeBEnd) > 24
    )
      throw new InvalidExportJobError('Cada rango puede abarcar como máximo 24 meses.');
    const indicators: AnnualComparisonIndicator[] = [
      'TOTAL_CASES',
      'NEW_CASES',
      'CONTROLS',
      'RATE_PER_1000',
      'ALERTS',
    ];
    if (
      typeof value.indicatorA !== 'string' ||
      typeof value.indicatorB !== 'string' ||
      !indicators.includes(value.indicatorA as AnnualComparisonIndicator) ||
      !indicators.includes(value.indicatorB as AnnualComparisonIndicator)
    )
      throw new InvalidExportJobError('El indicador de comparación no es válido.');
    return {
      dimension,
      rangeAStart,
      rangeAEnd,
      rangeBStart,
      rangeBEnd,
      indicatorA: value.indicatorA as AnnualComparisonIndicator,
      indicatorB: value.indicatorB as AnnualComparisonIndicator,
    };
  }

  private monthCount(start: string, end: string): number {
    const [startYear, startMonth] = start.split('-').map(Number);
    const [endYear, endMonth] = end.split('-').map(Number);
    return (endYear! - startYear!) * 12 + endMonth! - startMonth! + 1;
  }
}
