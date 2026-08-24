import {
  BadRequestException,
  BadGatewayException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { RequestWithContext } from '../../../common/http/request-context';
import {
  DataLevel,
  type AuthorizationSubject,
} from '../../authorization/domain/authorization.types';
import { CurrentSubject } from '../../authorization/http/current-subject.decorator';
import { RequireAccess } from '../../authorization/http/require-access.decorator';
import { ManagedUsersUseCase } from '../application/managed-users.use-case';
import {
  InvalidManagedUserError,
  IdentityInvitationError,
  ManagedUserConcurrencyError,
  ManagedUserConflictError,
  ManagedUserInvariantError,
  ManagedUserNotFoundError,
  ManagedUserRoleError,
  ManagedUserScopeError,
  type ManagedUser,
} from '../domain/managed-user';
import {
  ChangeManagedUserAccessDto,
  CreateManagedUserDto,
  LinkExternalIdentityDto,
  InviteManagedUserDto,
  UpdateManagedUserStatusDto,
} from './managed-users.dto';

@Controller('admin/users')
export class ManagedUsersController {
  constructor(private readonly users: ManagedUsersUseCase) {}

  @Get()
  @RequireAccess({
    permission: 'admin:users:read',
    dataLevel: DataLevel.Configuration,
    scope: 'OWN',
  })
  list(@CurrentSubject() subject: AuthorizationSubject): Promise<ManagedUser[]> {
    return this.users.list(subject);
  }

  @Post()
  @RequireAccess({
    permission: 'admin:users:create',
    dataLevel: DataLevel.Configuration,
    scope: 'OWN',
  })
  async create(
    @Body() body: CreateManagedUserDto,
    @CurrentSubject() subject: AuthorizationSubject,
    @Req() request: RequestWithContext,
  ): Promise<ManagedUser> {
    try {
      return await this.users.create({ ...body, requestId: request.requestId }, subject);
    } catch (error: unknown) {
      if (error instanceof ManagedUserConflictError) throw new ConflictException(error.message);
      if (error instanceof ManagedUserScopeError || error instanceof ManagedUserRoleError)
        throw new ForbiddenException(error.message);
      if (error instanceof InvalidManagedUserError) throw new BadRequestException(error.message);
      if (error instanceof IdentityInvitationError) throw new BadGatewayException(error.message);
      throw error;
    }
  }

  @Patch(':id/status')
  @RequireAccess({
    permission: 'admin:users:update',
    dataLevel: DataLevel.Configuration,
    scope: 'OWN',
  })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateManagedUserStatusDto,
    @CurrentSubject() subject: AuthorizationSubject,
    @Req() request: RequestWithContext,
  ): Promise<ManagedUser> {
    return this.handle(() =>
      this.users.updateStatus(id, { ...body, requestId: request.requestId }, subject),
    );
  }

  @Post(':id/access-changes')
  @RequireAccess({
    permission: 'admin:users:update',
    dataLevel: DataLevel.Configuration,
    scope: 'OWN',
  })
  changeAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ChangeManagedUserAccessDto,
    @CurrentSubject() subject: AuthorizationSubject,
    @Req() request: RequestWithContext,
  ): Promise<ManagedUser> {
    return this.handle(() =>
      this.users.changeAccess(id, { ...body, requestId: request.requestId }, subject),
    );
  }

  @Post(':id/external-identity')
  @RequireAccess({
    permission: 'admin:users:link',
    dataLevel: DataLevel.Configuration,
    scope: 'OWN',
  })
  linkExternalIdentity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: LinkExternalIdentityDto,
    @CurrentSubject() subject: AuthorizationSubject,
    @Req() request: RequestWithContext,
  ): Promise<ManagedUser> {
    return this.handle(() =>
      this.users.linkExternalIdentity(id, { ...body, requestId: request.requestId }, subject),
    );
  }

  @Post(':id/invitation')
  @RequireAccess({
    permission: 'admin:users:link',
    dataLevel: DataLevel.Configuration,
    scope: 'OWN',
  })
  invite(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: InviteManagedUserDto,
    @CurrentSubject() subject: AuthorizationSubject,
    @Req() request: RequestWithContext,
  ): Promise<ManagedUser> {
    return this.handle(() =>
      this.users.invite(id, { ...body, requestId: request.requestId }, subject),
    );
  }

  private async handle(operation: () => Promise<ManagedUser>): Promise<ManagedUser> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (error instanceof ManagedUserNotFoundError) throw new NotFoundException(error.message);
      if (
        error instanceof ManagedUserConcurrencyError ||
        error instanceof ManagedUserInvariantError ||
        error instanceof ManagedUserConflictError
      )
        throw new ConflictException(error.message);
      if (error instanceof ManagedUserScopeError || error instanceof ManagedUserRoleError)
        throw new ForbiddenException(error.message);
      if (error instanceof InvalidManagedUserError) throw new BadRequestException(error.message);
      if (error instanceof IdentityInvitationError) throw new BadGatewayException(error.message);
      throw error;
    }
  }
}
