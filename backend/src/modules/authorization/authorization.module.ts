import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { IdentityRepository } from './application/identity.repository';
import { TokenVerifier } from './application/token-verifier';
import { AuthorizationPolicy } from './domain/authorization.policy';
import { AuthenticationGuard } from './http/authentication.guard';
import { AuthorizationGuard } from './http/authorization.guard';
import { JwksTokenVerifier } from './infrastructure/jwks-token-verifier';
import { PrismaIdentityRepository } from './infrastructure/prisma-identity.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    AuthorizationPolicy,
    AuthenticationGuard,
    AuthorizationGuard,
    { provide: TokenVerifier, useClass: JwksTokenVerifier },
    { provide: IdentityRepository, useClass: PrismaIdentityRepository },
  ],
  exports: [AuthorizationPolicy, AuthenticationGuard, AuthorizationGuard],
})
export class AuthorizationModule {}
