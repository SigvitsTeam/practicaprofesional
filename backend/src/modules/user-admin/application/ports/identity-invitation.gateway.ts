import type { IdentityInvitationStatus } from '../../domain/managed-user';

export abstract class IdentityInvitationGateway {
  abstract invite(email: string): Promise<{ subject: string }>;
  abstract getStatus(subject: string): Promise<IdentityInvitationStatus>;
}
