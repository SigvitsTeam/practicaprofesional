import type { AuthorizationSubject } from '../domain/authorization.types';

export abstract class IdentityRepository {
  abstract findSubject(issuer: string, subject: string): Promise<AuthorizationSubject | null>;
}
