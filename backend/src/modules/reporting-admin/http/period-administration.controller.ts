import {
  BadRequestException,
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
  Req,
} from '@nestjs/common';
import {
  DataLevel,
  type AuthorizationSubject,
} from '../../authorization/domain/authorization.types';
import { CurrentSubject } from '../../authorization/http/current-subject.decorator';
import { RequireAccess } from '../../authorization/http/require-access.decorator';
import type { RequestWithContext } from '../../../common/http/request-context';
import { PeriodAdministrationUseCase } from '../application/period-administration.use-case';
import {
  PeriodAccessError,
  PeriodAdministrationError,
  PeriodConflictError,
  PeriodNotFoundError,
  type CalendarCreationResult,
  type AnnualOpeningResult,
  type ManagedPeriod,
  type PeriodAudit,
} from '../domain/calendar';
import {
  CalendarQueryDto,
  CreateCalendarDto,
  OpenPeriodDto,
  OpenYearDto,
} from './period-administration.dto';

@Controller('admin/reporting-periods')
@RequireAccess({
  permission: 'reporting:periods:manage',
  dataLevel: DataLevel.Configuration,
  scope: 'NATIONAL',
})
export class PeriodAdministrationController {
  constructor(private readonly periods: PeriodAdministrationUseCase) {}
  @Get()
  list(
    @Query() query: CalendarQueryDto,
    @CurrentSubject() subject: AuthorizationSubject,
  ): Promise<ManagedPeriod[]> {
    return this.handle(() => this.periods.list(query.year, subject));
  }
  @Post('calendar')
  create(
    @Body() body: CreateCalendarDto,
    @CurrentSubject() subject: AuthorizationSubject,
    @Req() request: RequestWithContext,
  ): Promise<CalendarCreationResult> {
    return this.handle(() =>
      this.periods.create(body.year, { ...body, requestId: request.requestId }, subject),
    );
  }
  @Post('open-year')
  openYear(
    @Body() body: OpenYearDto,
    @CurrentSubject() subject: AuthorizationSubject,
    @Req() request: RequestWithContext,
  ): Promise<AnnualOpeningResult> {
    return this.handle(() =>
      this.periods.openYear(
        body.year,
        body.expectedPeriods,
        { ...body, requestId: request.requestId },
        subject,
      ),
    );
  }
  @Post(':id/open')
  open(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: OpenPeriodDto,
    @CurrentSubject() subject: AuthorizationSubject,
    @Req() request: RequestWithContext,
  ): Promise<ManagedPeriod> {
    return this.handle(() =>
      this.periods.open(
        id,
        body.expectedUpdatedAt,
        { ...body, requestId: request.requestId },
        subject,
      ),
    );
  }
  @Get(':id/history')
  history(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentSubject() subject: AuthorizationSubject,
  ): Promise<PeriodAudit[]> {
    return this.handle(() => this.periods.history(id, subject));
  }
  private async handle<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (error instanceof PeriodAccessError) throw new ForbiddenException(error.message);
      if (error instanceof PeriodAdministrationError) throw new BadRequestException(error.message);
      if (error instanceof PeriodConflictError) throw new ConflictException(error.message);
      if (error instanceof PeriodNotFoundError) throw new NotFoundException(error.message);
      throw error;
    }
  }
}
