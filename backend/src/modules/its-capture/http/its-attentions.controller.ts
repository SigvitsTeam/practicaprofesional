import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  ServiceUnavailableException,
  StreamableFile,
} from '@nestjs/common';
import type { RequestWithContext } from '../../../common/http/request-context';
import { CurrentSubject } from '../../authorization/http/current-subject.decorator';
import { RequireAccess } from '../../authorization/http/require-access.decorator';
import {
  DataLevel,
  type AuthorizationSubject,
} from '../../authorization/domain/authorization.types';
import { CreateAttentionUseCase } from '../application/create-attention.use-case';
import { ListAttentionsUseCase } from '../application/list-attentions.use-case';
import { UpdateAttentionUseCase } from '../application/update-attention.use-case';
import { CancelAttentionUseCase } from '../application/cancel-attention.use-case';
import { GetCaptureContextUseCase } from '../application/get-capture-context.use-case';
import { GetMonthlyReportUseCase } from '../application/get-monthly-report.use-case';
import { ItsAttentionRepository } from '../application/ports/its-attention.repository';
import { RenderIts1PdfUseCase } from '../application/render-its1-pdf.use-case';
import { RenderIts2PdfUseCase } from '../application/render-its2-pdf.use-case';
import { RenderIts1XlsxUseCase } from '../application/render-its1-xlsx.use-case';
import { RenderIts2XlsxUseCase } from '../application/render-its2-xlsx.use-case';
import {
  CaptureConfigurationError,
  AttentionNotEditableError,
  AttentionNotFoundError,
  ConcurrentAttentionUpdateError,
  type AttentionPage,
  type AttentionRecord,
  type CaptureContext,
  InvalidAttentionError,
  type CreatedAttention,
  type CancelledAttention,
} from '../domain/its-attention';
import { CreateAttentionDto } from './create-attention.dto';
import { MonthlyReportQueryDto } from './monthly-report-query.dto';
import { ListAttentionsQueryDto } from './list-attentions-query.dto';
import { UpdateAttentionDto } from './update-attention.dto';
import type { ItsMonthlyReport } from '../domain/its-monthly-report';
import { CancelAttentionDto } from './cancel-attention.dto';

@Controller('its1/attentions')
export class ItsAttentionsController {
  constructor(
    private readonly createAttention: CreateAttentionUseCase,
    private readonly listAttentions: ListAttentionsUseCase,
    private readonly updateAttention: UpdateAttentionUseCase,
    private readonly cancelAttention: CancelAttentionUseCase,
    private readonly getCaptureContext: GetCaptureContextUseCase,
    private readonly getMonthlyReport: GetMonthlyReportUseCase,
    private readonly repository: ItsAttentionRepository,
    private readonly renderIts1Pdf: RenderIts1PdfUseCase,
    private readonly renderIts2Pdf: RenderIts2PdfUseCase,
    private readonly renderIts1Xlsx: RenderIts1XlsxUseCase,
    private readonly renderIts2Xlsx: RenderIts2XlsxUseCase,
  ) {}

  @Get()
  @RequireAccess({
    permission: 'its1:attentions:read',
    dataLevel: DataLevel.Individual,
    scope: 'OWN',
    target: (request) => ({
      facilityId:
        typeof request.query.facilityId === 'string' ? request.query.facilityId : undefined,
    }),
  })
  async list(@Query() query: ListAttentionsQueryDto): Promise<AttentionPage> {
    try {
      return await this.listAttentions.execute(query);
    } catch (error: unknown) {
      if (error instanceof InvalidAttentionError) throw new BadRequestException(error.message);
      throw error;
    }
  }

  @Get('context')
  @RequireAccess({
    permission: 'its1:attentions:read',
    dataLevel: DataLevel.Configuration,
    scope: 'OWN',
  })
  context(@CurrentSubject() subject: AuthorizationSubject): Promise<CaptureContext> {
    return this.getCaptureContext.execute(subject.territory.facilityIds);
  }

  @Get('monthly-report')
  @RequireAccess({
    permission: 'its2:reports:read',
    dataLevel: DataLevel.Aggregated,
    scope: 'OWN',
    target: (request) => ({
      facilityId:
        typeof request.query.facilityId === 'string' ? request.query.facilityId : undefined,
    }),
  })
  monthlyReport(@Query() query: MonthlyReportQueryDto): Promise<ItsMonthlyReport> {
    return this.getMonthlyReport.execute(query.facilityId, query.year, query.month);
  }

  @Get('monthly-report.pdf')
  @RequireAccess({
    permission: 'its2:reports:read',
    dataLevel: DataLevel.Aggregated,
    scope: 'OWN',
    target: (request) => ({
      facilityId:
        typeof request.query.facilityId === 'string' ? request.query.facilityId : undefined,
    }),
  })
  async monthlyReportPdf(@Query() query: MonthlyReportQueryDto): Promise<StreamableFile> {
    const report = await this.getMonthlyReport.execute(query.facilityId, query.year, query.month);
    const pdf = await this.renderIts2Pdf.execute(report);
    const contents = Buffer.from(pdf);
    return new StreamableFile(contents, {
      type: 'application/pdf',
      disposition: `attachment; filename="ITS-2-${report.facility.code}-${report.year}-${String(report.month).padStart(2, '0')}.pdf"`,
      length: contents.length,
    });
  }

  @Get('monthly-report.xlsx')
  @RequireAccess({
    permission: 'its2:reports:read',
    dataLevel: DataLevel.Aggregated,
    scope: 'OWN',
    target: (request) => ({
      facilityId:
        typeof request.query.facilityId === 'string' ? request.query.facilityId : undefined,
    }),
  })
  async monthlyReportXlsx(@Query() query: MonthlyReportQueryDto): Promise<StreamableFile> {
    const report = await this.getMonthlyReport.execute(query.facilityId, query.year, query.month);
    const xlsx = await this.renderIts2Xlsx.execute(report);
    const contents = Buffer.from(xlsx);
    return new StreamableFile(contents, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="ITS-2-${report.facility.code}-${report.year}-${String(report.month).padStart(2, '0')}.xlsx"`,
      length: contents.length,
    });
  }

  @Get('register.pdf')
  @RequireAccess({
    permission: 'its1:attentions:read',
    dataLevel: DataLevel.Individual,
    scope: 'OWN',
    target: (request) => ({
      facilityId:
        typeof request.query.facilityId === 'string' ? request.query.facilityId : undefined,
    }),
  })
  async printRegister(
    @Query() query: MonthlyReportQueryDto,
    @CurrentSubject() subject: AuthorizationSubject,
  ): Promise<StreamableFile> {
    const register = await this.repository.getIts1PrintRegister({
      facilityId: query.facilityId,
      userId: subject.userId,
      year: query.year,
      month: query.month,
    });
    const pdf = await this.renderIts1Pdf.execute(register);
    const contents = Buffer.from(pdf);
    return new StreamableFile(contents, {
      type: 'application/pdf',
      disposition: `attachment; filename="ITS-1-${register.facility.code}-${register.year}-${String(register.month).padStart(2, '0')}.pdf"`,
      length: contents.length,
    });
  }

  @Get('register.xlsx')
  @RequireAccess({
    permission: 'its1:attentions:read',
    dataLevel: DataLevel.Individual,
    scope: 'OWN',
    target: (request) => ({
      facilityId:
        typeof request.query.facilityId === 'string' ? request.query.facilityId : undefined,
    }),
  })
  async printRegisterXlsx(
    @Query() query: MonthlyReportQueryDto,
    @CurrentSubject() subject: AuthorizationSubject,
  ): Promise<StreamableFile> {
    const register = await this.repository.getIts1PrintRegister({
      facilityId: query.facilityId,
      userId: subject.userId,
      year: query.year,
      month: query.month,
    });
    const xlsx = await this.renderIts1Xlsx.execute(register);
    const contents = Buffer.from(xlsx);
    return new StreamableFile(contents, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="ITS-1-${register.facility.code}-${register.year}-${String(register.month).padStart(2, '0')}.xlsx"`,
      length: contents.length,
    });
  }

  @Post()
  @RequireAccess({
    permission: 'its1:attentions:create',
    dataLevel: DataLevel.Individual,
    scope: 'OWN',
    target: (request) => ({ facilityId: (request.body as CreateAttentionDto).facilityId }),
  })
  async create(
    @Body() body: CreateAttentionDto,
    @CurrentSubject() subject: AuthorizationSubject,
    @Req() request: RequestWithContext,
  ): Promise<CreatedAttention> {
    try {
      return await this.createAttention.execute({
        ...body,
        attentionDate: new Date(`${body.attentionDate}T00:00:00.000Z`),
        userId: subject.userId,
        requestId: request.requestId,
        diagnoses: body.diagnoses,
      });
    } catch (error: unknown) {
      if (error instanceof InvalidAttentionError) throw new BadRequestException(error.message);
      if (error instanceof CaptureConfigurationError)
        throw new ServiceUnavailableException(error.message);
      if (error instanceof AttentionNotEditableError) throw new ConflictException(error.message);
      throw error;
    }
  }

  @Patch(':id')
  @RequireAccess({
    permission: 'its1:attentions:update',
    dataLevel: DataLevel.Individual,
    scope: 'OWN',
    target: (request) => ({ facilityId: (request.body as UpdateAttentionDto).facilityId }),
  })
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateAttentionDto,
    @CurrentSubject() subject: AuthorizationSubject,
    @Req() request: RequestWithContext,
  ): Promise<AttentionRecord> {
    try {
      return await this.updateAttention.execute({
        ...body,
        id,
        attentionDate: new Date(`${body.attentionDate}T00:00:00.000Z`),
        expectedUpdatedAt: new Date(body.expectedUpdatedAt),
        userId: subject.userId,
        requestId: request.requestId,
        diagnoses: body.diagnoses,
      });
    } catch (error: unknown) {
      if (error instanceof InvalidAttentionError) throw new BadRequestException(error.message);
      if (error instanceof CaptureConfigurationError)
        throw new ServiceUnavailableException(error.message);
      if (error instanceof AttentionNotFoundError) throw new NotFoundException(error.message);
      if (
        error instanceof AttentionNotEditableError ||
        error instanceof ConcurrentAttentionUpdateError
      )
        throw new ConflictException(error.message);
      throw error;
    }
  }

  @Patch(':id/cancel')
  @RequireAccess({
    permission: 'its1:attentions:cancel',
    dataLevel: DataLevel.Individual,
    scope: 'OWN',
    target: (request) => ({ facilityId: (request.body as CancelAttentionDto).facilityId }),
  })
  async cancel(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: CancelAttentionDto,
    @CurrentSubject() subject: AuthorizationSubject,
    @Req() request: RequestWithContext,
  ): Promise<CancelledAttention> {
    try {
      return await this.cancelAttention.execute({
        id,
        facilityId: body.facilityId,
        expectedUpdatedAt: new Date(body.expectedUpdatedAt),
        userId: subject.userId,
        requestId: request.requestId,
        reason: body.reason,
      });
    } catch (error: unknown) {
      if (error instanceof InvalidAttentionError) throw new BadRequestException(error.message);
      if (error instanceof AttentionNotFoundError) throw new NotFoundException(error.message);
      if (
        error instanceof AttentionNotEditableError ||
        error instanceof ConcurrentAttentionUpdateError
      )
        throw new ConflictException(error.message);
      throw error;
    }
  }
}
