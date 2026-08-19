import { Injectable } from '@nestjs/common';
import type { AuthorizationSubject } from '../../authorization/domain/authorization.types';
import {
  InvalidTerritorialDataError,
  TerritorialParentNotFoundError,
  TerritorialScopeDeniedError,
  type CreateFacilityInput,
  type CreateMunicipalityInput,
  type FacilitySummary,
  type MunicipalitySummary,
} from '../domain/territorial-catalog';
import { TerritorialCatalogRepository } from './ports/territorial-catalog.repository';

@Injectable()
export class TerritorialCatalogUseCase {
  constructor(private readonly repository: TerritorialCatalogRepository) {}

  async list(subject: AuthorizationSubject): Promise<{
    municipalities: MunicipalitySummary[];
    facilities: FacilitySummary[];
  }> {
    const regionIds = subject.territory.national ? undefined : subject.territory.regionIds;
    const municipalities = await this.repository.listMunicipalities(regionIds);
    const allowedMunicipalityIds = municipalities.map(({ id }) => id);
    const facilities = await this.repository.listFacilities(
      subject.territory.national ? undefined : allowedMunicipalityIds,
    );
    return { municipalities, facilities };
  }

  async createMunicipality(
    input: Omit<CreateMunicipalityInput, 'audit'>,
    subject: AuthorizationSubject,
    audit: CreateMunicipalityInput['audit'],
  ): Promise<MunicipalitySummary> {
    const region = await this.repository.findRegion(input.regionId);
    if (!region?.active) throw new TerritorialParentNotFoundError('La región activa no existe.');
    this.requireRegion(input.regionId, subject);
    return this.repository.createMunicipality({
      ...input,
      officialCode: this.code(input.officialCode),
      name: this.name(input.name, 120),
      audit,
    });
  }

  async createFacility(
    input: Omit<CreateFacilityInput, 'audit'>,
    subject: AuthorizationSubject,
    audit: CreateFacilityInput['audit'],
  ): Promise<FacilitySummary> {
    const municipality = await this.repository.findMunicipality(input.municipalityId);
    if (!municipality?.active)
      throw new TerritorialParentNotFoundError('El municipio activo no existe.');
    this.requireRegion(municipality.regionId, subject);
    return this.repository.createFacility({
      ...input,
      code: this.code(input.code),
      name: this.name(input.name, 160),
      type: this.name(input.type, 50),
      address: input.address?.trim().replace(/\s+/g, ' ') || null,
      audit,
    });
  }

  private requireRegion(regionId: string, subject: AuthorizationSubject): void {
    if (!subject.territory.national && !subject.territory.regionIds.includes(regionId))
      throw new TerritorialScopeDeniedError();
  }

  private code(value: string): string {
    const code = value.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]{1,29}$/.test(code))
      throw new InvalidTerritorialDataError(
        'El código debe contener entre 2 y 30 caracteres alfanuméricos, guion o guion bajo.',
      );
    return code;
  }

  private name(value: string, maximum: number): string {
    const normalized = value.trim().replace(/\s+/g, ' ');
    if (normalized.length < 2 || normalized.length > maximum)
      throw new InvalidTerritorialDataError(
        `El valor debe contener entre 2 y ${maximum} caracteres.`,
      );
    return normalized;
  }
}
