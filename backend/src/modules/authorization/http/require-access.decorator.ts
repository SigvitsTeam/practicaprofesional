import { SetMetadata } from '@nestjs/common';
import type { DataLevel } from '../domain/authorization.types';

export type AccessScope = 'OWN' | 'NATIONAL';

export interface AccessRequirement {
  permission: string;
  dataLevel: DataLevel;
  scope: AccessScope;
}

export const ACCESS_REQUIREMENT_KEY = 'authorization:requirement';
export const RequireAccess = (requirement: AccessRequirement): MethodDecorator & ClassDecorator =>
  SetMetadata(ACCESS_REQUIREMENT_KEY, requirement);
