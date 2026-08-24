import type {
  RoleCode,
  TerritorialScopeType,
} from '../../authorization/domain/authorization.types';

export interface ManagedUser {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  active: boolean;
  hasExternalIdentity: boolean;
  role: { code: RoleCode; name: string; startDate: Date };
  assignment: {
    scopeType: TerritorialScopeType;
    regionId: string | null;
    municipalityId: string | null;
    facilityId: string | null;
    label: string;
    startDate: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ManagedUserContext {
  id: string;
  email: string;
  active: boolean;
  hasExternalIdentity: boolean;
  roleCode: RoleCode;
  regionId: string | null;
  updatedAt: Date;
}

export interface LinkExternalIdentityInput {
  userId: string;
  issuer: string;
  subject: string;
  activate: boolean;
  expectedUpdatedAt: Date;
  actorUserId: string;
  requestId: string;
  reason: string;
}

export interface CreateManagedUserInput {
  fullName: string;
  email: string;
  phone: string | null;
  roleCode: RoleCode;
  scopeType: TerritorialScopeType;
  regionId: string | null;
  municipalityId: string | null;
  facilityId: string | null;
  startDate: Date;
  actorUserId: string;
  requestId: string;
  reason: string;
}

export class InvalidManagedUserError extends Error {}
export class ManagedUserConflictError extends Error {}
export class ManagedUserScopeError extends Error {}
export class ManagedUserRoleError extends Error {}
export class ManagedUserNotFoundError extends Error {}
export class ManagedUserConcurrencyError extends Error {}
export class ManagedUserInvariantError extends Error {}
export class IdentityInvitationError extends Error {}
