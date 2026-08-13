import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Post,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { RequestWithContext } from '../../../common/http/request-context';
import type { Response } from 'express';
import { CurrentSubject } from '../../authorization/http/current-subject.decorator';
import { RequireAccess } from '../../authorization/http/require-access.decorator';
import {
  DataLevel,
  type AuthorizationSubject,
} from '../../authorization/domain/authorization.types';
import { CreateAttentionUseCase } from '../application/create-attention.use-case';
import { GetCaptureContextUseCase } from '../application/get-capture-context.use-case';
import { GetMonthlyReportUseCase } from '../application/get-monthly-report.use-case';
import { ItsAttentionRepository } from '../application/ports/its-attention.repository';
import { RenderIts1PdfUseCase } from '../application/render-its1-pdf.use-case';
import { RenderIts2PdfUseCase } from '../application/render-its2-pdf.use-case';
import {
  CaptureConfigurationError,
  type CaptureContext,
  InvalidAttentionError,
  type CreatedAttention,
} from '../domain/its-attention';
import { CreateAttentionDto } from './create-attention.dto';
import { MonthlyReportQueryDto } from './monthly-report-query.dto';
import type { ItsMonthlyReport } from '../domain/its-monthly-report';

@Controller('its1/attentions')
export class ItsAttentionsController {
  constructor(
    private readonly createAttention: CreateAttentionUseCase,
    private readonly getCaptureContext: GetCaptureContextUseCase,
    private readonly getMonthlyReport: GetMonthlyReportUseCase,
    private readonly repository: ItsAttentionRepository,
    private readonly renderIts1Pdf: RenderIts1PdfUseCase,
    private readonly renderIts2Pdf: RenderIts2PdfUseCase,
  ) {}

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
    permission: 'its1:attentions:read',
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
  @Header('Content-Type', 'application/pdf')
  @RequireAccess({
    permission: 'its1:attentions:read',
    dataLevel: DataLevel.Aggregated,
    scope: 'OWN',
    target: (request) => ({
      facilityId:
        typeof request.query.facilityId === 'string' ? request.query.facilityId : undefined,
    }),
  })
  async monthlyReportPdf(
    @Query() query: MonthlyReportQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Buffer> {
    const report = await this.getMonthlyReport.execute(query.facilityId, query.year, query.month);
    const pdf = await this.renderIts2Pdf.execute(report);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="ITS-2-${report.facility.code}-${report.year}-${String(report.month).padStart(2, '0')}.pdf"`,
    );
    return Buffer.from(pdf);
  }

  @Get('register.pdf')
  @Header('Content-Type', 'application/pdf')
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
    @Res({ passthrough: true }) response: Response,
  ): Promise<Buffer> {
    const register = await this.repository.getIts1PrintRegister({
      facilityId: query.facilityId,
      userId: subject.userId,
      year: query.year,
      month: query.month,
    });
    const pdf = await this.renderIts1Pdf.execute(register);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="ITS-1-${register.facility.code}-${register.year}-${String(register.month).padStart(2, '0')}.pdf"`,
    );
    return Buffer.from(pdf);
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
      throw error;
    }
  }
}
