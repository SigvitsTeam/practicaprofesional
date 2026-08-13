import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IdentityProviderUnavailableError,
  InvalidAccessTokenError,
  TokenVerifier,
  type VerifiedIdentity,
} from '../application/token-verifier';

const INVALID_TOKEN_ERRORS = new Set([
  'JOSEAlgNotAllowed',
  'JWSInvalid',
  'JWSSignatureVerificationFailed',
  'JWTClaimValidationFailed',
  'JWTExpired',
  'JWTInvalid',
  'JWKSNoMatchingKey',
]);

@Injectable()
export class JwksTokenVerifier extends TokenVerifier {
  private readonly issuer?: string;
  private readonly audience?: string;
  private readonly jwksUrl?: string;
  private readonly clockTolerance: number;
  private readonly timeoutDuration: number;
  private keySet?: ReturnType<(typeof import('jose'))['createRemoteJWKSet']>;

  constructor(config: ConfigService) {
    super();
    this.issuer = config.get<string>('auth.issuer');
    this.audience = config.get<string>('auth.audience');
    this.jwksUrl = config.get<string>('auth.jwksUrl');
    this.clockTolerance = config.getOrThrow<number>('auth.clockToleranceSeconds');
    this.timeoutDuration = config.getOrThrow<number>('auth.jwksTimeoutMs');
  }

  async verify(token: string): Promise<VerifiedIdentity> {
    if (!this.issuer || !this.audience || !this.jwksUrl) {
      throw new IdentityProviderUnavailableError();
    }
    if (token.length > 8_192) throw new InvalidAccessTokenError();

    try {
      const jose = await import('jose');
      this.keySet ??= jose.createRemoteJWKSet(new URL(this.jwksUrl), {
        timeoutDuration: this.timeoutDuration,
        cooldownDuration: 30_000,
        cacheMaxAge: 600_000,
      });
      const { payload } = await jose.jwtVerify(token, this.keySet, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['ES256', 'RS256'],
        clockTolerance: this.clockTolerance,
      });

      if (typeof payload.iss !== 'string' || typeof payload.sub !== 'string') {
        throw new InvalidAccessTokenError();
      }
      return { issuer: payload.iss, subject: payload.sub };
    } catch (error: unknown) {
      if (error instanceof InvalidAccessTokenError) throw error;
      if (error instanceof Error && INVALID_TOKEN_ERRORS.has(error.constructor.name)) {
        throw new InvalidAccessTokenError();
      }
      throw new IdentityProviderUnavailableError();
    }
  }
}
