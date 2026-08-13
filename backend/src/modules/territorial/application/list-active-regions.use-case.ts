import { Injectable } from '@nestjs/common';
import type { Region } from '../domain/region';
import type { GrantedTerritory } from '../../authorization/domain/authorization.types';
import { RegionRepository } from './ports/region.repository';

@Injectable()
export class ListActiveRegionsUseCase {
  constructor(private readonly regions: RegionRepository) {}

  execute(territory: GrantedTerritory): Promise<Region[]> {
    return this.regions.listActive(territory.national ? undefined : territory.regionIds);
  }
}
