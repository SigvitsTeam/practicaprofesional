export abstract class IdentityInvitationGateway {
  abstract invite(email: string): Promise<{ subject: string }>;
}
