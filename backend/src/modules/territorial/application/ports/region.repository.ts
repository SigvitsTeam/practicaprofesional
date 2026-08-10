import type { AuditContext, NewRegion, Region } from '../../domain/region';

export abstract class RegionRepository {
  abstract findByCode(code: string): Promise<Region | null>;
  abstract create(region: NewRegion, audit: AuditContext): Promise<Region>;
  abstract listActive(regionIds?: readonly string[]): Promise<Region[]>;
}
