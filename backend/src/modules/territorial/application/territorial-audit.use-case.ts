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

  async listTerritoryEvents(
    entityType: 'NACIONAL' | 'REGION' | 'ESTABLECIMIENTO',
    entityId: string | undefined,
    limit: number,
    cursor: string | undefined,
    subject: AuthorizationSubject,
  ): Promise<TerritorialAuditPage> {
    if (entityType !== 'NACIONAL') {
      const regionId = entityId
        ? await this.repository.findTerritoryRegion(entityType, entityId)
        : null;
      if (!regionId) throw new TerritorialAuditTargetNotFoundError('El territorio no existe.');
      if (!subject.territory.national && !subject.territory.regionIds.includes(regionId))
        throw new TerritorialAuditScopeDeniedError(
          'El historial solicitado está fuera del alcance territorial asignado.',
        );
    }
    return this.repository.listTerritoryEvents({
      entityType,
      entityId,
      limit,
      cursor,
      regionIds: subject.territory.national ? undefined : subject.territory.regionIds,
    });
  }

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

  async listNetworkEvents(
    networkId: string,
    limit: number,
    cursor: string | undefined,
    subject: AuthorizationSubject,
  ): Promise<TerritorialAuditPage> {
    const regionId = await this.repository.findNetworkRegion(networkId);
    if (!regionId) throw new TerritorialAuditTargetNotFoundError('La red no existe.');
    if (!subject.territory.national && !subject.territory.regionIds.includes(regionId))
      throw new TerritorialAuditScopeDeniedError(
        'El historial solicitado está fuera del alcance territorial asignado.',
      );
    return this.repository.listNetworkEvents({ networkId, limit, cursor });
  }
}
