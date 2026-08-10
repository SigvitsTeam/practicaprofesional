import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RequestWithContext } from '../../../common/http/request-context';
import { IdentityRepository } from '../application/identity.repository';
import {
  IdentityProviderUnavailableError,
  InvalidAccessTokenError,
  TokenVerifier,
} from '../application/token-verifier';
import { PUBLIC_ROUTE_KEY } from './public.decorator';

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: TokenVerifier,
    private readonly identities: IdentityRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithContext>();
    const token = this.extractBearerToken(request.header('authorization'));
    try {
      const identity = await this.verifier.verify(token);
      const subject = await this.identities.findSubject(identity.issuer, identity.subject);
      if (!subject) throw new UnauthorizedException('Credenciales no válidas.');
      request.auth = subject;
      return true;
    } catch (error: unknown) {
      if (error instanceof IdentityProviderUnavailableError) {
        throw new ServiceUnavailableException('La verificación de identidad no está disponible.');
      }
      if (error instanceof InvalidAccessTokenError || error instanceof UnauthorizedException) {
        throw new UnauthorizedException('Credenciales no válidas.');
      }
      throw error;
    }
  }

  private extractBearerToken(header: string | undefined): string {
    if (!header) throw new UnauthorizedException('Credenciales no válidas.');
    const match = /^Bearer ([^\s]+)$/.exec(header);
    if (!match?.[1]) throw new UnauthorizedException('Credenciales no válidas.');
    return match[1];
  }
}
