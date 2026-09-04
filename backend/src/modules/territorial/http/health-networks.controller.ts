import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { RequestWithContext } from '../../../common/http/request-context';
import {
  DataLevel,
  type AuthorizationSubject,
} from '../../authorization/domain/authorization.types';
import { CurrentSubject } from '../../authorization/http/current-subject.decorator';
import { RequireAccess } from '../../authorization/http/require-access.decorator';
import { HealthNetworksUseCase } from '../application/health-networks.use-case';
import {
  HealthNetworkConcurrencyError,
  HealthNetworkConflictError,
  HealthNetworkNotFoundError,
  HealthNetworkStatusTransitionError,
  InvalidHealthNetworkError,
  type HealthNetworkSummary,
} from '../domain/health-network';
import { TerritorialScopeDeniedError } from '../domain/territorial-catalog';
import {
  CreateHealthNetworkDto,
  ListHealthNetworksDto,
  ReplaceNetworkMunicipalitiesDto,
  UpdateHealthNetworkStatusDto,
} from './health-networks.dto';

@Controller('territories/networks')
export class HealthNetworksController {
  constructor(private readonly networks: HealthNetworksUseCase) {}
  @Get()
  @RequireAccess({
    permission: 'territorial:networks:read',
    dataLevel: DataLevel.Configuration,
    scope: 'OWN',
  })
  async list(
    @CurrentSubject() subject: AuthorizationSubject,
    @Query() query: ListHealthNetworksDto,
  ): Promise<HealthNetworkSummary[]> {
    try {
      return await this.networks.list(subject, query.asOf);
    } catch (error: unknown) {
      if (error instanceof InvalidHealthNetworkError) throw new BadRequestException(error.message);
      throw error;
    }
  }

  @Post()
  @RequireAccess({
    permission: 'territorial:networks:create',
    dataLevel: DataLevel.Configuration,
    scope: 'OWN',
  })
  create(
    @Body() body: CreateHealthNetworkDto,
    @CurrentSubject() subject: AuthorizationSubject,
    @Req() request: RequestWithContext,
  ): Promise<HealthNetworkSummary> {
    return this.handle(() =>
      this.networks.create(body, subject, {
        actorUserId: subject.userId,
        requestId: request.requestId,
        reason: body.reason,
      }),
    );
  }

  @Put(':id/municipalities')
  @RequireAccess({
    permission: 'territorial:networks:update',
    dataLevel: DataLevel.Configuration,
    scope: 'OWN',
  })
  replaceMunicipalities(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReplaceNetworkMunicipalitiesDto,
    @CurrentSubject() subject: AuthorizationSubject,
    @Req() request: RequestWithContext,
  ): Promise<HealthNetworkSummary> {
    return this.handle(() =>
      this.networks.replaceMunicipalities(id, body, subject, {
        actorUserId: subject.userId,
        requestId: request.requestId,
        reason: body.reason,
      }),
    );
  }

  @Patch(':id/status')
  @RequireAccess({
    permission: 'territorial:networks:update',
    dataLevel: DataLevel.Configuration,
    scope: 'OWN',
  })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateHealthNetworkStatusDto,
    @CurrentSubject() subject: AuthorizationSubject,
    @Req() request: RequestWithContext,
  ): Promise<HealthNetworkSummary> {
    return this.handle(() =>
      this.networks.updateStatus(id, body, subject, {
        actorUserId: subject.userId,
        requestId: request.requestId,
        reason: body.reason,
      }),
    );
  }

  private async handle(
    operation: () => Promise<HealthNetworkSummary>,
  ): Promise<HealthNetworkSummary> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (error instanceof HealthNetworkNotFoundError) throw new NotFoundException(error.message);
      if (
        error instanceof HealthNetworkConflictError ||
        error instanceof HealthNetworkConcurrencyError
      )
        throw new ConflictException(error.message);
      if (error instanceof TerritorialScopeDeniedError) throw new ForbiddenException(error.message);
      if (
        error instanceof InvalidHealthNetworkError ||
        error instanceof HealthNetworkStatusTransitionError
      )
        throw new BadRequestException(error.message);
      throw error;
    }
  }
}
