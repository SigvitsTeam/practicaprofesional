import { SetMetadata } from '@nestjs/common';
import type { RequestWithContext } from '../../../common/http/request-context';
import type { DataLevel, TargetTerritory } from '../domain/authorization.types';

export type AccessScope = 'OWN' | 'NATIONAL';

export interface AccessRequirement {
  permission: string;
  dataLevel: DataLevel;
  scope: AccessScope;
  target?: (request: RequestWithContext) => TargetTerritory;
}

export const ACCESS_REQUIREMENT_KEY = 'authorization:requirement';
export const RequireAccess = (requirement: AccessRequirement): MethodDecorator & ClassDecorator =>
  SetMetadata(ACCESS_REQUIREMENT_KEY, requirement);
