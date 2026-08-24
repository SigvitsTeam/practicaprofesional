import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { ManagedUsersUseCase } from './application/managed-users.use-case';
import { ManagedUserRepository } from './application/ports/managed-user.repository';
import { ManagedUsersController } from './http/managed-users.controller';
import { PrismaManagedUserRepository } from './infrastructure/prisma-managed-user.repository';
import { IdentityInvitationGateway } from './application/ports/identity-invitation.gateway';
import { SupabaseIdentityInvitationGateway } from './infrastructure/supabase-identity-invitation.gateway';

@Module({
  imports: [DatabaseModule],
  providers: [
    ManagedUsersUseCase,
    { provide: ManagedUserRepository, useClass: PrismaManagedUserRepository },
    { provide: IdentityInvitationGateway, useClass: SupabaseIdentityInvitationGateway },
  ],
  controllers: [ManagedUsersController],
})
export class UserAdminModule {}
