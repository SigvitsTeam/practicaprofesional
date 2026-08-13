import { Injectable } from '@nestjs/common';
import {
  InvalidRegionDataError,
  RegionCodeAlreadyExistsError,
  type AuditContext,
  type NewRegion,
  type Region,
  type RegionType,
} from '../domain/region';
import { RegionRepository } from './ports/region.repository';

export interface CreateRegionCommand {
  code: string;
  name: string;
  regionNumber?: string;
  type: RegionType;
  audit: AuditContext;
}

@Injectable()
export class CreateRegionUseCase {
  constructor(private readonly regions: RegionRepository) {}

  async execute(command: CreateRegionCommand): Promise<Region> {
    const newRegion = this.normalize(command);
    const existingRegion = await this.regions.findByCode(newRegion.code);
    if (existingRegion) throw new RegionCodeAlreadyExistsError(newRegion.code);

    return this.regions.create(newRegion, command.audit);
  }

  private normalize(command: CreateRegionCommand): NewRegion {
    const code = command.code.trim().toUpperCase();
    const name = command.name.trim().replace(/\s+/g, ' ');
    const regionNumber = command.regionNumber?.trim() || null;

    if (!/^[A-Z0-9][A-Z0-9_-]{1,29}$/.test(code)) {
      throw new InvalidRegionDataError(
        'El código debe contener entre 2 y 30 caracteres alfanuméricos, guion o guion bajo.',
      );
    }
    if (name.length < 3 || name.length > 120) {
      throw new InvalidRegionDataError('El nombre debe contener entre 3 y 120 caracteres.');
    }
    if (regionNumber && regionNumber.length > 30) {
      throw new InvalidRegionDataError('El número de región no puede exceder 30 caracteres.');
    }

    return { code, name, regionNumber, type: command.type };
  }
}
