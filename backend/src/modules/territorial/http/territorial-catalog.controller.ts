import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
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
import { TerritorialCatalogUseCase } from '../application/territorial-catalog.use-case';
import {
  InvalidTerritorialDataError,
  TerritorialCodeAlreadyExistsError,
  TerritorialParentNotFoundError,
  TerritorialScopeDeniedError,
} from '../domain/territorial-catalog';
import type { FacilitySummary, MunicipalitySummary } from '../domain/territorial-catalog';
import { CreateFacilityDto, CreateMunicipalityDto } from './territorial-catalog.dto';

@Controller('territories')
export class TerritorialCatalogController {
  constructor(private readonly catalog: TerritorialCatalogUseCase) {}

  @Get('catalog')
  @RequireAccess({
    permission: 'territorial:catalog:read',
    dataLevel: DataLevel.Configuration,
    scope: 'OWN',
  })
  list(@CurrentSubject() subject: AuthorizationSubject): Promise<{
    municipalities: MunicipalitySummary[];
    facilities: FacilitySummary[];
  }> {
    return this.catalog.list(subject);
  }

  @Post('municipalities')
  @RequireAccess({
    permission: 'territorial:municipalities:create',
    dataLevel: DataLevel.Configuration,
    scope: 'OWN',
  })
  async createMunicipality(
    @Body() body: CreateMunicipalityDto,
    @CurrentSubject() subject: AuthorizationSubject,
    @Req() request: RequestWithContext,
  ): Promise<MunicipalitySummary> {
    return this.handle(() =>
      this.catalog.createMunicipality(
        { regionId: body.regionId, officialCode: body.officialCode, name: body.name },
        subject,
        { actorUserId: subject.userId, requestId: request.requestId, reason: body.reason },
      ),
    );
  }

  @Post('facilities')
  @RequireAccess({
    permission: 'territorial:facilities:create',
    dataLevel: DataLevel.Configuration,
    scope: 'OWN',
  })
  async createFacility(
    @Body() body: CreateFacilityDto,
    @CurrentSubject() subject: AuthorizationSubject,
    @Req() request: RequestWithContext,
  ): Promise<FacilitySummary> {
    return this.handle(() =>
      this.catalog.createFacility(
        {
          municipalityId: body.municipalityId,
          code: body.code,
          name: body.name,
          type: body.type,
          address: body.address ?? null,
        },
        subject,
        { actorUserId: subject.userId, requestId: request.requestId, reason: body.reason },
      ),
    );
  }

  private async handle<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (error instanceof TerritorialCodeAlreadyExistsError)
        throw new ConflictException(error.message);
      if (error instanceof TerritorialParentNotFoundError)
        throw new NotFoundException(error.message);
      if (error instanceof TerritorialScopeDeniedError) throw new ForbiddenException(error.message);
      if (error instanceof InvalidTerritorialDataError)
        throw new BadRequestException(error.message);
      throw error;
    }
  }
}
