import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Post,
  Req,
} from '@nestjs/common';
import type { RequestWithContext } from '../../../common/http/request-context';
import { CurrentSubject } from '../../authorization/http/current-subject.decorator';
import { RequireAccess } from '../../authorization/http/require-access.decorator';
import {
  DataLevel,
  type AuthorizationSubject,
} from '../../authorization/domain/authorization.types';
import { CreateRegionUseCase } from '../application/create-region.use-case';
import { ListActiveRegionsUseCase } from '../application/list-active-regions.use-case';
import {
  InvalidRegionDataError,
  RegionCodeAlreadyExistsError,
  type Region,
} from '../domain/region';
import { CreateRegionDto } from './create-region.dto';

@Controller('regions')
export class RegionsController {
  constructor(
    private readonly createRegion: CreateRegionUseCase,
    private readonly listRegions: ListActiveRegionsUseCase,
  ) {}

  @Get()
  @RequireAccess({
    permission: 'territorial:regions:read',
    dataLevel: DataLevel.Configuration,
    scope: 'OWN',
  })
  list(@CurrentSubject() subject: AuthorizationSubject): Promise<Region[]> {
    return this.listRegions.execute(subject.territory);
  }

  @Post()
  @RequireAccess({
    permission: 'territorial:regions:create',
    dataLevel: DataLevel.Configuration,
    scope: 'NATIONAL',
  })
  async create(
    @Body() body: CreateRegionDto,
    @CurrentSubject() subject: AuthorizationSubject,
    @Req() request: RequestWithContext,
  ): Promise<Region> {
    try {
      return await this.createRegion.execute({
        code: body.code,
        name: body.name,
        regionNumber: body.regionNumber,
        type: body.type,
        audit: {
          actorUserId: subject.userId,
          requestId: request.requestId,
          reason: body.reason,
        },
      });
    } catch (error: unknown) {
      if (error instanceof RegionCodeAlreadyExistsError) throw new ConflictException(error.message);
      if (error instanceof InvalidRegionDataError) throw new BadRequestException(error.message);
      throw error;
    }
  }
}
