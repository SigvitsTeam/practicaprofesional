import type { RoleCode } from '../../../authorization/domain/authorization.types';
import type {
  CreateManagedUserInput,
  ManagedUser,
  ManagedUserContext,
  LinkExternalIdentityInput,
} from '../../domain/managed-user';

export abstract class ManagedUserRepository {
  abstract list(regionIds?: readonly string[]): Promise<ManagedUser[]>;
  abstract roleExists(code: RoleCode): Promise<boolean>;
  abstract resolveTerritory(
    input: Pick<CreateManagedUserInput, 'scopeType' | 'regionId' | 'municipalityId' | 'facilityId'>,
  ): Promise<{ regionId: string | null; label: string } | null>;
  abstract create(input: CreateManagedUserInput): Promise<ManagedUser>;
  abstract findContext(userId: string): Promise<ManagedUserContext | null>;
  abstract countActiveSuperAdmins(): Promise<number>;
  abstract updateStatus(input: {
    userId: string;
    active: boolean;
    expectedUpdatedAt: Date;
    actorUserId: string;
    requestId: string;
    reason: string;
  }): Promise<ManagedUser>;
  abstract changeAccess(
    input: CreateManagedUserInput & { userId: string; expectedUpdatedAt: Date },
  ): Promise<ManagedUser>;
  abstract linkExternalIdentity(input: LinkExternalIdentityInput): Promise<ManagedUser>;
}
