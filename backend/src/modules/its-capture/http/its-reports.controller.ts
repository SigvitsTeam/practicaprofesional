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
} from '@nestjs/common';
import {
  DataLevel,
  type AuthorizationSubject,
} from '../../authorization/domain/authorization.types';
import { CurrentSubject } from '../../authorization/http/current-subject.decorator';
import { RequireAccess } from '../../authorization/http/require-access.decorator';
import { ItsReportWorkflowUseCase } from '../application/its-report-workflow.use-case';
import {
  ItsReportAccessError,
  ItsReportNotFoundError,
  ItsReportWorkflowError,
  type Its2ReportSummary,
} from '../domain/its-report-workflow';
import {
  ApproveIts2ReportDto,
  CurrentIts2ReportQueryDto,
  Its2ReportPeriodQueryDto,
  PrepareIts2ReportDto,
  ReturnIts2ReportDto,
} from './its-report-workflow.dto';

@Controller('its2/reports')
export class ItsReportsController {
  constructor(private readonly workflow: ItsReportWorkflowUseCase) {}

  @Get('current')
  @RequireAccess({
    permission: 'its2:reports:read',
    dataLevel: DataLevel.Aggregated,
    scope: 'OWN',
    target: (request) => ({
      facilityId:
        typeof request.query.facilityId === 'string' ? request.query.facilityId : undefined,
    }),
  })
  async current(
    @Query() query: CurrentIts2ReportQueryDto,
    @CurrentSubject() subject: AuthorizationSubject,
  ): Promise<Its2ReportSummary | null> {
    return (
      (await this.execute(() =>
        this.workflow.getCurrent(query.facilityId, query.year, query.month, subject),
      )) ?? null
    );
  }

  @Get('municipal-inbox')
  @RequireAccess({
    permission: 'its2:reports:review',
    dataLevel: DataLevel.Aggregated,
    scope: 'OWN',
  })
  municipalInbox(
    @Query() query: Its2ReportPeriodQueryDto,
    @CurrentSubject() subject: AuthorizationSubject,
  ): Promise<Its2ReportSummary[]> {
    return this.execute(() => this.workflow.listMunicipalInbox(query.year, query.month, subject));
  }

  @Post('prepare')
  @RequireAccess({
    permission: 'its2:reports:prepare',
    dataLevel: DataLevel.Aggregated,
    scope: 'OWN',
    target: (request) => ({ facilityId: (request.body as PrepareIts2ReportDto).facilityId }),
  })
  prepare(
    @Body() body: PrepareIts2ReportDto,
    @CurrentSubject() subject: AuthorizationSubject,
  ): Promise<Its2ReportSummary> {
    return this.execute(() => this.workflow.prepare(body, subject));
  }

  @Post(':id/submit')
  @RequireAccess({
    permission: 'its2:reports:submit',
    dataLevel: DataLevel.Aggregated,
    scope: 'OWN',
  })
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentSubject() subject: AuthorizationSubject,
  ): Promise<Its2ReportSummary> {
    return this.execute(() => this.workflow.submit(id, subject));
  }

  @Post(':id/return')
  @RequireAccess({
    permission: 'its2:reports:review',
    dataLevel: DataLevel.Aggregated,
    scope: 'OWN',
  })
  returnToFacility(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReturnIts2ReportDto,
    @CurrentSubject() subject: AuthorizationSubject,
  ): Promise<Its2ReportSummary> {
    return this.execute(() => this.workflow.returnToFacility(id, body.comment, subject));
  }

  @Post(':id/approve')
  @RequireAccess({
    permission: 'its2:reports:review',
    dataLevel: DataLevel.Aggregated,
    scope: 'OWN',
  })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ApproveIts2ReportDto,
    @CurrentSubject() subject: AuthorizationSubject,
  ): Promise<Its2ReportSummary> {
    return this.execute(() => this.workflow.approveMunicipally(id, body.comment, subject));
  }

  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (error instanceof ItsReportAccessError) throw new ForbiddenException(error.message);
      if (error instanceof ItsReportNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof ItsReportWorkflowError) throw new ConflictException(error.message);
      if (error instanceof Error && error.name === 'PrismaClientKnownRequestError')
        throw new BadRequestException('No fue posible completar la operación ITS-2.');
      throw error;
    }
  }
}
