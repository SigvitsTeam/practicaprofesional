import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Header,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import {
  DataLevel,
  type AuthorizationSubject,
} from '../../authorization/domain/authorization.types';
import { CurrentSubject } from '../../authorization/http/current-subject.decorator';
import { RequireAccess } from '../../authorization/http/require-access.decorator';
import { MunicipalConsolidationUseCase } from '../application/municipal-consolidation.use-case';
import { GetMonthlyReportUseCase } from '../application/get-monthly-report.use-case';
import { RenderIts2PdfUseCase } from '../application/render-its2-pdf.use-case';
import { RenderIts2XlsxUseCase } from '../application/render-its2-xlsx.use-case';
import { mergeMunicipalMonthlyReports, type ItsMonthlyReport } from '../domain/its-monthly-report';
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
  constructor(
    private readonly workflow: MunicipalConsolidationUseCase,
    private readonly getMonthlyReport: GetMonthlyReportUseCase,
    private readonly renderIts2Pdf: RenderIts2PdfUseCase,
    private readonly renderIts2Xlsx: RenderIts2XlsxUseCase,
  ) {}

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

  @Get('current.xlsx')
  @Header('Cache-Control', 'private, no-store')
  @RequireAccess({
    permission: 'its2:reports:read',
    dataLevel: DataLevel.Aggregated,
    scope: 'OWN',
    target: (request) => ({
      municipalityId:
        typeof request.query.municipalityId === 'string' ? request.query.municipalityId : undefined,
    }),
  })
  async currentXlsx(
    @Query() query: MunicipalConsolidationPeriodDto,
    @CurrentSubject() subject: AuthorizationSubject,
  ): Promise<StreamableFile> {
    const report = await this.downloadReport(query, subject);
    const contents = Buffer.from(await this.renderIts2Xlsx.execute(report));
    return new StreamableFile(contents, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="ITS-2-Consolidado-Municipal-${report.facility.code}-${report.year}-${String(report.month).padStart(2, '0')}.xlsx"`,
      length: contents.length,
    });
  }

  @Get('current.pdf')
  @Header('Cache-Control', 'private, no-store')
  @RequireAccess({
    permission: 'its2:reports:read',
    dataLevel: DataLevel.Aggregated,
    scope: 'OWN',
    target: (request) => ({
      municipalityId:
        typeof request.query.municipalityId === 'string' ? request.query.municipalityId : undefined,
    }),
  })
  async currentPdf(
    @Query() query: MunicipalConsolidationPeriodDto,
    @CurrentSubject() subject: AuthorizationSubject,
  ): Promise<StreamableFile> {
    const report = await this.downloadReport(query, subject);
    const contents = Buffer.from(await this.renderIts2Pdf.execute(report));
    return new StreamableFile(contents, {
      type: 'application/pdf',
      disposition: `attachment; filename="ITS-2-Consolidado-Municipal-${report.facility.code}-${report.year}-${String(report.month).padStart(2, '0')}.pdf"`,
      length: contents.length,
    });
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

  private async downloadReport(
    query: MunicipalConsolidationPeriodDto,
    subject: AuthorizationSubject,
  ): Promise<ItsMonthlyReport> {
    const consolidation = await this.execute(() =>
      this.workflow.getCurrent(query.municipalityId, query.year, query.month, subject),
    );
    if (!consolidation)
      throw new NotFoundException('Prepare primero el consolidado municipal del período.');
    const reports = await Promise.all(
      consolidation.sourceReports.map((source) =>
        this.getMonthlyReport.execute(source.facility.id, query.year, query.month),
      ),
    );
    return mergeMunicipalMonthlyReports(
      reports,
      {
        id: consolidation.municipality.id,
        code: consolidation.municipality.code,
        name: consolidation.municipality.name,
        regionName: reports[0]?.facility.regionName ?? '',
      },
      query.year,
      query.month,
    );
  }
}
