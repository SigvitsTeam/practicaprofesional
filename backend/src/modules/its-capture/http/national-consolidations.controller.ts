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
import { NationalConsolidationUseCase } from '../application/national-consolidation.use-case';
import {
  NationalConsolidationAccessError,
  NationalConsolidationError,
  NationalConsolidationNotFoundError,
  type NationalConsolidationContext,
  type NationalConsolidationSummary,
} from '../domain/national-consolidation';
import {
  NationalPeriodDto,
  NationalReasonDto,
  NationalTransitionDto,
  PrepareNationalDto,
} from './national-consolidation.dto';

@Controller('its2/national-consolidations')
export class NationalConsolidationsController {
  constructor(private readonly workflow: NationalConsolidationUseCase) {}

  @Get('context')
  @RequireAccess({
    permission: 'its2:national:prepare',
    dataLevel: DataLevel.Configuration,
    scope: 'NATIONAL',
  })
  context(@CurrentSubject() subject: AuthorizationSubject): Promise<NationalConsolidationContext> {
    return this.execute(() => this.workflow.getContext(subject));
  }

  @Get('current')
  @RequireAccess({
    permission: 'its2:reports:read',
    dataLevel: DataLevel.Aggregated,
    scope: 'NATIONAL',
  })
  async current(
    @Query() query: NationalPeriodDto,
    @CurrentSubject() subject: AuthorizationSubject,
  ): Promise<NationalConsolidationSummary | null> {
    return (
      (await this.execute(() => this.workflow.getCurrent(query.year, query.month, subject))) ?? null
    );
  }

  @Post('prepare')
  @RequireAccess({
    permission: 'its2:national:prepare',
    dataLevel: DataLevel.Aggregated,
    scope: 'NATIONAL',
  })
  prepare(
    @Body() body: PrepareNationalDto,
    @CurrentSubject() subject: AuthorizationSubject,
  ): Promise<NationalConsolidationSummary> {
    return this.execute(() => this.workflow.prepare(body, subject));
  }

  @Post(':id/finalize')
  @RequireAccess({
    permission: 'its2:national:prepare',
    dataLevel: DataLevel.Aggregated,
    scope: 'NATIONAL',
  })
  finalize(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: NationalTransitionDto,
    @CurrentSubject() subject: AuthorizationSubject,
  ): Promise<NationalConsolidationSummary> {
    return this.execute(() => this.workflow.finalize(id, body.comment, subject));
  }

  @Post(':id/close')
  @RequireAccess({
    permission: 'its2:national:close',
    dataLevel: DataLevel.Aggregated,
    scope: 'NATIONAL',
  })
  close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: NationalReasonDto,
    @CurrentSubject() subject: AuthorizationSubject,
  ): Promise<NationalConsolidationSummary> {
    return this.execute(() => this.workflow.close(id, body.reason, subject));
  }

  @Post(':id/reopen')
  @RequireAccess({
    permission: 'its2:national:reopen',
    dataLevel: DataLevel.Aggregated,
    scope: 'NATIONAL',
  })
  reopen(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: NationalReasonDto,
    @CurrentSubject() subject: AuthorizationSubject,
  ): Promise<NationalConsolidationSummary> {
    return this.execute(() => this.workflow.reopen(id, body.reason, subject));
  }

  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (error instanceof NationalConsolidationAccessError)
        throw new ForbiddenException(error.message);
      if (error instanceof NationalConsolidationNotFoundError)
        throw new NotFoundException(error.message);
      if (error instanceof NationalConsolidationError) throw new ConflictException(error.message);
      if (error instanceof Error && error.name === 'PrismaClientKnownRequestError')
        throw new ConflictException(
          'Otra operación modificó el cierre nacional. Recargue el estado.',
        );
      throw error;
    }
  }
}
