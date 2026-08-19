import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  DataLevel,
  type AuthorizationSubject,
} from '../../authorization/domain/authorization.types';
import { CurrentSubject } from '../../authorization/http/current-subject.decorator';
import { RequireAccess } from '../../authorization/http/require-access.decorator';
import { MunicipalConsolidationUseCase } from '../application/municipal-consolidation.use-case';
import {
  MunicipalConsolidationAccessError,
  MunicipalConsolidationError,
  MunicipalConsolidationNotFoundError,
  type MunicipalConsolidationSummary,
  type MunicipalConsolidationContext,
} from '../domain/municipal-consolidation';
import { Its2ReportPeriodQueryDto, ReturnIts2ReportDto } from './its-report-workflow.dto';
import {
  MunicipalConsolidationPeriodDto,
  MunicipalTransitionDto,
  PrepareMunicipalConsolidationDto,
} from './municipal-consolidation.dto';

@Controller('its2/municipal-consolidations')
export class MunicipalConsolidationsController {
  constructor(private readonly workflow: MunicipalConsolidationUseCase) {}

  @Get('context')
  @RequireAccess({
    permission: 'its2:municipal:prepare',
    dataLevel: DataLevel.Configuration,
    scope: 'OWN',
  })
  context(@CurrentSubject() subject: AuthorizationSubject): Promise<MunicipalConsolidationContext> {
    return this.execute(() => this.workflow.getContext(subject));
  }

  @Get('current')
  @RequireAccess({
    permission: 'its2:reports:read',
    dataLevel: DataLevel.Aggregated,
    scope: 'OWN',
    target: (request) => ({
      municipalityId:
        typeof request.query.municipalityId === 'string' ? request.query.municipalityId : undefined,
    }),
  })
  async current(
    @Query() query: MunicipalConsolidationPeriodDto,
    @CurrentSubject() subject: AuthorizationSubject,
  ): Promise<MunicipalConsolidationSummary | null> {
    return (
      (await this.execute(() =>
        this.workflow.getCurrent(query.municipalityId, query.year, query.month, subject),
      )) ?? null
    );
  }

  @Post('prepare')
  @RequireAccess({
    permission: 'its2:municipal:prepare',
    dataLevel: DataLevel.Aggregated,
    scope: 'OWN',
    target: (request) => ({
      municipalityId: (request.body as PrepareMunicipalConsolidationDto).municipalityId,
    }),
  })
  prepare(
    @Body() body: PrepareMunicipalConsolidationDto,
    @CurrentSubject() subject: AuthorizationSubject,
  ): Promise<MunicipalConsolidationSummary> {
    return this.execute(() => this.workflow.prepare(body, subject));
  }

  @Post(':id/submit-region')
  @RequireAccess({
    permission: 'its2:municipal:submit',
    dataLevel: DataLevel.Aggregated,
    scope: 'OWN',
  })
  submitRegion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: MunicipalTransitionDto,
    @CurrentSubject() subject: AuthorizationSubject,
  ): Promise<MunicipalConsolidationSummary> {
    return this.execute(() => this.workflow.submitToRegion(id, body.comment, subject));
  }

  @Get('regional-inbox')
  @RequireAccess({
    permission: 'its2:regional:review',
    dataLevel: DataLevel.Aggregated,
    scope: 'OWN',
  })
  regionalInbox(
    @Query() query: Its2ReportPeriodQueryDto,
    @CurrentSubject() subject: AuthorizationSubject,
  ): Promise<MunicipalConsolidationSummary[]> {
    return this.execute(() => this.workflow.listRegionalInbox(query.year, query.month, subject));
  }

  @Post(':id/return-municipality')
  @RequireAccess({
    permission: 'its2:regional:review',
    dataLevel: DataLevel.Aggregated,
    scope: 'OWN',
  })
  returnMunicipality(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReturnIts2ReportDto,
    @CurrentSubject() subject: AuthorizationSubject,
  ): Promise<MunicipalConsolidationSummary> {
    return this.execute(() => this.workflow.returnToMunicipality(id, body.comment, subject));
  }

  @Post(':id/approve-region')
  @RequireAccess({
    permission: 'its2:regional:review',
    dataLevel: DataLevel.Aggregated,
    scope: 'OWN',
  })
  approveRegion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: MunicipalTransitionDto,
    @CurrentSubject() subject: AuthorizationSubject,
  ): Promise<MunicipalConsolidationSummary> {
    return this.execute(() => this.workflow.approveRegionally(id, body.comment, subject));
  }

  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (error instanceof MunicipalConsolidationAccessError)
        throw new ForbiddenException(error.message);
      if (error instanceof MunicipalConsolidationNotFoundError)
        throw new NotFoundException(error.message);
      if (error instanceof MunicipalConsolidationError) throw new ConflictException(error.message);
      if (error instanceof Error && error.name === 'PrismaClientKnownRequestError')
        throw new ConflictException(
          'Otra operación modificó el consolidado. Recargue el estado antes de continuar.',
        );
      throw error;
    }
  }
}
