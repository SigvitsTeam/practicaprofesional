import { Injectable } from '@nestjs/common';
import type { AuthorizationSubject } from '../../authorization/domain/authorization.types';
import {
  ExportJobScopeError,
  InvalidExportJobError,
  type CreateExportJobInput,
  type ExportJob,
  type ExportScopeLevel,
} from '../domain/export-job';
import { ExportJobRepository } from './ports/export-job.repository';

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
    if (!['TERRITORIAL_SUMMARY', 'ITS2_MONTHLY'].includes(input.reportType))
      throw new InvalidExportJobError('El tipo de reporte no es válido.');
    if (input.reportType === 'ITS2_MONTHLY' && input.scopeLevel !== 'ESTABLECIMIENTO')
      throw new InvalidExportJobError('El ITS-2 mensual requiere alcance de establecimiento.');
    if (input.year < 2000 || input.year > 2100 || input.month < 1 || input.month > 12)
      throw new InvalidExportJobError('El período solicitado no es válido.');
    const territoryId = input.territoryId ?? this.defaultTerritory(input.scopeLevel, subject);
    this.requireScope(input.scopeLevel, territoryId, subject);
    return this.repository.create({ ...input, territoryId, requestedByUserId: subject.userId });
  }

  private defaultTerritory(level: ExportScopeLevel, subject: AuthorizationSubject): string | null {
    if (level === 'NACIONAL') return null;
    if (level === 'REGION') return subject.territory.regionIds[0] ?? null;
    if (level === 'MUNICIPIO') return subject.territory.municipalityIds[0] ?? null;
    return subject.territory.facilityIds[0] ?? null;
  }

  private requireScope(
    level: ExportScopeLevel,
    territoryId: string | null,
    subject: AuthorizationSubject,
  ): void {
    const allowed =
      level === 'NACIONAL'
        ? !territoryId && subject.territory.national
        : level === 'REGION'
          ? !!territoryId &&
            (subject.territory.national || subject.territory.regionIds.includes(territoryId))
          : level === 'MUNICIPIO'
            ? !!territoryId &&
              (subject.territory.national ||
                subject.territory.municipalityIds.includes(territoryId))
            : !!territoryId &&
              (subject.territory.national || subject.territory.facilityIds.includes(territoryId));
    if (!allowed)
      throw new ExportJobScopeError('La exportación está fuera del alcance territorial asignado.');
  }
}
