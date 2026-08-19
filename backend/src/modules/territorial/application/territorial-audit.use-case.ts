import { Injectable } from '@nestjs/common';
import type { AuthorizationSubject } from '../../authorization/domain/authorization.types';
import {
  TerritorialAuditScopeDeniedError,
  TerritorialAuditTargetNotFoundError,
  type TerritorialAuditPage,
} from '../domain/territorial-audit';
import { TerritorialAuditRepository } from './ports/territorial-audit.repository';

@Injectable()
export class TerritorialAuditUseCase {
  constructor(private readonly repository: TerritorialAuditRepository) {}

  async listMunicipalityEvents(
    municipalityId: string,
    limit: number,
    cursor: string | undefined,
    subject: AuthorizationSubject,
  ): Promise<TerritorialAuditPage> {
    const regionId = await this.repository.findMunicipalityRegion(municipalityId);
    if (!regionId) throw new TerritorialAuditTargetNotFoundError('El municipio no existe.');
    if (!subject.territory.national && !subject.territory.regionIds.includes(regionId))
      throw new TerritorialAuditScopeDeniedError(
        'El historial solicitado está fuera del alcance territorial asignado.',
      );
    return this.repository.listMunicipalityEvents({ municipalityId, limit, cursor });
  }
}
