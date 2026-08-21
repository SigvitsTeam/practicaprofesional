import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
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
import { ExportJobsUseCase } from '../application/export-jobs.use-case';
import {
  ExportJobConflictError,
  ExportJobScopeError,
  InvalidExportJobError,
  type ExportJob,
} from '../domain/export-job';
import { CreateExportJobDto } from './export-jobs.dto';

@Controller('exports/jobs')
export class ExportJobsController {
  constructor(private readonly jobs: ExportJobsUseCase) {}

  @Get()
  @RequireAccess({ permission: 'exports:jobs:read', dataLevel: DataLevel.Aggregated, scope: 'OWN' })
  list(@CurrentSubject() subject: AuthorizationSubject): Promise<ExportJob[]> {
    return this.jobs.listOwn(subject);
  }

  @Post()
  @RequireAccess({
    permission: 'exports:jobs:create',
    dataLevel: DataLevel.Aggregated,
    scope: 'OWN',
  })
  async create(
    @Body() body: CreateExportJobDto,
    @CurrentSubject() subject: AuthorizationSubject,
    @Req() request: RequestWithContext,
  ): Promise<ExportJob> {
    try {
      return await this.jobs.create(
        { ...body, territoryId: body.territoryId ?? null, requestId: request.requestId },
        subject,
      );
    } catch (error: unknown) {
      if (error instanceof ExportJobScopeError) throw new ForbiddenException(error.message);
      if (error instanceof ExportJobConflictError) throw new ConflictException(error.message);
      if (error instanceof InvalidExportJobError) throw new BadRequestException(error.message);
      throw error;
    }
  }
}
