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
import { RegionalConsolidationUseCase } from '../application/regional-consolidation.use-case';
import {
  RegionalConsolidationAccessError,
  RegionalConsolidationError,
  RegionalConsolidationNotFoundError,
  type RegionalConsolidationContext,
  type RegionalConsolidationSummary,
} from '../domain/regional-consolidation';
import { Its2ReportPeriodQueryDto, ReturnIts2ReportDto } from './its-report-workflow.dto';
import {
  PrepareRegionalConsolidationDto,
  RegionalConsolidationPeriodDto,
  RegionalTransitionDto,
} from './regional-consolidation.dto';

@Controller('its2/regional-consolidations')
export class RegionalConsolidationsController {
  constructor(private readonly workflow: RegionalConsolidationUseCase) {}

  @Get('context')
  @RequireAccess({
    permission: 'its2:regional:prepare',
    dataLevel: DataLevel.Configuration,
    scope: 'OWN',
  })
  context(@CurrentSubject() subject: AuthorizationSubject): Promise<RegionalConsolidationContext> {
    return this.execute(() => this.workflow.getContext(subject));
  }

  @Get('current')
  @RequireAccess({
    permission: 'its2:reports:read',
    dataLevel: DataLevel.Aggregated,
    scope: 'OWN',
    target: (request) => ({
      regionId: typeof request.query.regionId === 'string' ? request.query.regionId : undefined,
    }),
  })
  async current(
    @Query() query: RegionalConsolidationPeriodDto,
    @CurrentSubject() subject: AuthorizationSubject,
  ): Promise<RegionalConsolidationSummary | null> {
    return (
      (await this.execute(() =>
        this.workflow.getCurrent(query.regionId, query.year, query.month, subject),
      )) ?? null
    );
  }

  @Post('prepare')
  @RequireAccess({
    permission: 'its2:regional:prepare',
    dataLevel: DataLevel.Aggregated,
    scope: 'OWN',
    target: (request) => ({ regionId: (request.body as PrepareRegionalConsolidationDto).regionId }),
  })
  prepare(
    @Body() body: PrepareRegionalConsolidationDto,
    @CurrentSubject() subject: AuthorizationSubject,
  ): Promise<RegionalConsolidationSummary> {
    return this.execute(() => this.workflow.prepare(body, subject));
  }

  @Post(':id/submit-central')
  @RequireAccess({
    permission: 'its2:regional:submit',
    dataLevel: DataLevel.Aggregated,
    scope: 'OWN',
  })
  submitCentral(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RegionalTransitionDto,
    @CurrentSubject() subject: AuthorizationSubject,
  ): Promise<RegionalConsolidationSummary> {
    return this.execute(() => this.workflow.submitToCentral(id, body.comment, subject));
  }

  @Get('central-inbox')
  @RequireAccess({
    permission: 'its2:central:review',
    dataLevel: DataLevel.Aggregated,
    scope: 'NATIONAL',
  })
  centralInbox(
    @Query() query: Its2ReportPeriodQueryDto,
    @CurrentSubject() subject: AuthorizationSubject,
  ): Promise<RegionalConsolidationSummary[]> {
    return this.execute(() => this.workflow.listCentralInbox(query.year, query.month, subject));
  }

  @Post(':id/return-region')
  @RequireAccess({
    permission: 'its2:central:review',
    dataLevel: DataLevel.Aggregated,
    scope: 'NATIONAL',
  })
  returnRegion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReturnIts2ReportDto,
    @CurrentSubject() subject: AuthorizationSubject,
  ): Promise<RegionalConsolidationSummary> {
    return this.execute(() => this.workflow.returnToRegion(id, body.comment, subject));
  }

  @Post(':id/approve-central')
  @RequireAccess({
    permission: 'its2:central:review',
    dataLevel: DataLevel.Aggregated,
    scope: 'NATIONAL',
  })
  approveCentral(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RegionalTransitionDto,
    @CurrentSubject() subject: AuthorizationSubject,
  ): Promise<RegionalConsolidationSummary> {
    return this.execute(() => this.workflow.approveCentrally(id, body.comment, subject));
  }

  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (error instanceof RegionalConsolidationAccessError)
        throw new ForbiddenException(error.message);
      if (error instanceof RegionalConsolidationNotFoundError)
        throw new NotFoundException(error.message);
      if (error instanceof RegionalConsolidationError) throw new ConflictException(error.message);
      if (error instanceof Error && error.name === 'PrismaClientKnownRequestError')
        throw new ConflictException(
          'Otra operación modificó el consolidado. Recargue el estado antes de continuar.',
        );
      throw error;
    }
  }
}
