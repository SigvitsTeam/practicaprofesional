import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import type { RequestWithContext } from '../../../common/http/request-context';
import { AuthorizationPolicy } from '../domain/authorization.policy';
import { DataLevel, RoleCode, type AuthorizationSubject } from '../domain/authorization.types';
import { AuthorizationGuard } from './authorization.guard';
import type { AccessRequirement } from './require-access.decorator';

describe('AuthorizationGuard', () => {
  const requirement: AccessRequirement = {
    permission: 'territorial:regions:create',
    dataLevel: DataLevel.Configuration,
    scope: 'NATIONAL',
  };

  function guard(): AuthorizationGuard {
    const reflector = {
      getAllAndOverride: (key: string) => (key.includes('public') ? false : requirement),
    } as unknown as Reflector;
    return new AuthorizationGuard(reflector, new AuthorizationPolicy());
  }

  function context(auth: AuthorizationSubject): ExecutionContext {
    const request: Pick<RequestWithContext, 'auth'> = { auth };
    return new ExecutionContextHost([request], class TestController {}, (): void => undefined);
  }

  it('allows a permission only when national territory is explicitly assigned', () => {
    const subject: AuthorizationSubject = {
      userId: 'user-1',
      roles: [RoleCode.SuperAdmin],
      permissions: ['territorial:regions:create'],
      territory: { national: true, regionIds: [], municipalityIds: [], facilityIds: [] },
    };

    expect(guard().canActivate(context(subject))).toBe(true);
  });

  it('denies the same permission when the user only has regional scope', () => {
    const subject: AuthorizationSubject = {
      userId: 'user-2',
      roles: [RoleCode.RegionalSuperAdmin],
      permissions: ['territorial:regions:create'],
      territory: {
        national: false,
        regionIds: ['region-cortes'],
        municipalityIds: [],
        facilityIds: [],
      },
    };

    expect(() => guard().canActivate(context(subject))).toThrow('Acceso denegado.');
  });
});
