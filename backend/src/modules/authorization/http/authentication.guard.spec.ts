import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { RequestWithContext } from '../../../common/http/request-context';
import { IdentityRepository } from '../application/identity.repository';
import { TokenVerifier, type VerifiedIdentity } from '../application/token-verifier';
import { RoleCode, type AuthorizationSubject } from '../domain/authorization.types';
import { AuthenticationGuard } from './authentication.guard';

class FakeTokenVerifier extends TokenVerifier {
  lastToken?: string;

  verify(token: string): Promise<VerifiedIdentity> {
    this.lastToken = token;
    return Promise.resolve({ issuer: 'https://issuer.example', subject: 'external-user-1' });
  }
}

class FakeIdentityRepository extends IdentityRepository {
  constructor(private readonly result: AuthorizationSubject | null) {
    super();
  }

  findSubject(): Promise<AuthorizationSubject | null> {
    return Promise.resolve(this.result);
  }
}

describe('AuthenticationGuard', () => {
  const subject: AuthorizationSubject = {
    userId: 'user-1',
    roles: [RoleCode.SuperAdmin],
    permissions: ['territorial:regions:read'],
    territory: { national: true, regionIds: [], municipalityIds: [], facilityIds: [] },
  };

  function context(request: Partial<RequestWithContext>): ExecutionContext {
    return {
      getHandler: () => (): void => undefined,
      getClass: () => class TestController {},
      switchToHttp: () => ({ getRequest: () => request }),
    } as ExecutionContext;
  }

  it('verifies the bearer token and attaches only the institutional subject', async () => {
    const verifier = new FakeTokenVerifier();
    const reflector = { getAllAndOverride: () => false } as unknown as Reflector;
    const guard = new AuthenticationGuard(reflector, verifier, new FakeIdentityRepository(subject));
    const request = {
      header: (name: string) => (name === 'authorization' ? 'Bearer signed-token' : undefined),
    } as RequestWithContext;

    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(verifier.lastToken).toBe('signed-token');
    expect(request.auth).toEqual(subject);
  });

  it('does not authenticate a valid external identity absent from the institutional database', async () => {
    const reflector = { getAllAndOverride: () => false } as unknown as Reflector;
    const guard = new AuthenticationGuard(
      reflector,
      new FakeTokenVerifier(),
      new FakeIdentityRepository(null),
    );
    const request = {
      header: () => 'Bearer signed-token',
    } as RequestWithContext;

    await expect(guard.canActivate(context(request))).rejects.toThrow('Credenciales no válidas.');
  });
});
