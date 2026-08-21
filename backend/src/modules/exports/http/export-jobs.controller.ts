import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  GoneException,
  Header,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import type { RequestWithContext } from '../../../common/http/request-context';
import {
  DataLevel,
  type AuthorizationSubject,
} from '../../authorization/domain/authorization.types';
import { CurrentSubject } from '../../authorization/http/current-subject.decorator';
import { RequireAccess } from '../../authorization/http/require-access.decorator';
import { ExportJobsUseCase } from '../application/export-jobs.use-case';
import { DownloadExportArtifactUseCase } from '../application/download-export-artifact.use-case';
import {
  ExportArtifactExpiredError,
  ExportArtifactAccessError,
  ExportArtifactNotFoundError,
  ExportJobConflictError,
  ExportJobScopeError,
  InvalidExportJobError,
  type ExportJob,
} from '../domain/export-job';
import { CreateExportJobDto, CreateIts1ExportJobDto } from './export-jobs.dto';

@Controller('exports/jobs')
export class ExportJobsController {
  constructor(
    private readonly jobs: ExportJobsUseCase,
    private readonly downloadArtifact: DownloadExportArtifactUseCase,
  ) {}

  @Get()
  @RequireAccess({ permission: 'exports:jobs:read', dataLevel: DataLevel.Aggregated, scope: 'OWN' })
  list(@CurrentSubject() subject: AuthorizationSubject): Promise<ExportJob[]> {
    return this.jobs.listOwn(subject);
  }

  @Post('its1')
  @RequireAccess({
    permission: 'its1:attentions:read',
    dataLevel: DataLevel.Individual,
    scope: 'OWN',
    target: (request) => ({
      facilityId: (request.body as CreateIts1ExportJobDto).facilityId,
    }),
  })
  async createIts1(
    @Body() body: CreateIts1ExportJobDto,
    @CurrentSubject() subject: AuthorizationSubject,
    @Req() request: RequestWithContext,
  ): Promise<ExportJob> {
    try {
      return await this.jobs.createIts1({ ...body, requestId: request.requestId }, subject);
    } catch (error: unknown) {
      if (error instanceof ExportJobScopeError) throw new ForbiddenException(error.message);
      if (error instanceof ExportJobConflictError) throw new ConflictException(error.message);
      if (error instanceof InvalidExportJobError) throw new BadRequestException(error.message);
      throw error;
    }
  }

  @Get(':id/download')
  @Header('Cache-Control', 'private, no-store')
  @RequireAccess({ permission: 'exports:jobs:read', dataLevel: DataLevel.Aggregated, scope: 'OWN' })
  async download(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentSubject() subject: AuthorizationSubject,
    @Req() request: RequestWithContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Buffer> {
    try {
      const artifact = await this.downloadArtifact.execute(id, subject, request.requestId);
      response.setHeader(
        'Content-Type',
        artifact.format === 'PDF'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      response.setHeader('Content-Disposition', `attachment; filename="${artifact.filename}"`);
      return Buffer.from(artifact.contents);
    } catch (error: unknown) {
      if (error instanceof ExportArtifactAccessError) throw new ForbiddenException(error.message);
      if (error instanceof ExportArtifactExpiredError) throw new GoneException(error.message);
      if (error instanceof ExportArtifactNotFoundError) throw new NotFoundException(error.message);
      throw error;
    }
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
