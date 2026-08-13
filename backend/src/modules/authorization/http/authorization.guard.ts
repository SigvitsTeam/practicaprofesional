import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RequestWithContext } from '../../../common/http/request-context';
import { AuthorizationPolicy } from '../domain/authorization.policy';
import { ACCESS_REQUIREMENT_KEY, type AccessRequirement } from './require-access.decorator';
import { PUBLIC_ROUTE_KEY } from './public.decorator';

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly policy: AuthorizationPolicy,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (
      this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    const requirement = this.reflector.getAllAndOverride<AccessRequirement>(
      ACCESS_REQUIREMENT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requirement)
      throw new ForbiddenException('La operación no tiene una política de acceso definida.');

    const request = context.switchToHttp().getRequest<RequestWithContext>();
    if (!request.auth) throw new ForbiddenException('Acceso denegado.');
    const target =
      requirement.scope === 'NATIONAL' ? { national: true } : (requirement.target?.(request) ?? {});
    const decision = this.policy.evaluate(request.auth, {
      permission: requirement.permission,
      dataLevel: requirement.dataLevel,
      target,
    });
    if (!decision.allowed) throw new ForbiddenException('Acceso denegado.');
    return true;
  }
}
