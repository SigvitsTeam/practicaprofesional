import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { CreateAttentionUseCase } from './application/create-attention.use-case';
import { GetCaptureContextUseCase } from './application/get-capture-context.use-case';
import { GetMonthlyReportUseCase } from './application/get-monthly-report.use-case';
import { RenderIts2PdfUseCase } from './application/render-its2-pdf.use-case';
import { RenderIts1PdfUseCase } from './application/render-its1-pdf.use-case';
import { ItsAttentionRepository } from './application/ports/its-attention.repository';
import { ItsAttentionsController } from './http/its-attentions.controller';
import { PrismaItsAttentionRepository } from './infrastructure/prisma-its-attention.repository';
import { ItsReportWorkflowUseCase } from './application/its-report-workflow.use-case';
import { ItsReportWorkflowRepository } from './application/ports/its-report-workflow.repository';
import { ItsReportsController } from './http/its-reports.controller';
import { PrismaItsReportWorkflowRepository } from './infrastructure/prisma-its-report-workflow.repository';
import { ListAttentionsUseCase } from './application/list-attentions.use-case';
import { UpdateAttentionUseCase } from './application/update-attention.use-case';
import { CancelAttentionUseCase } from './application/cancel-attention.use-case';
import { MunicipalConsolidationUseCase } from './application/municipal-consolidation.use-case';
import { MunicipalConsolidationRepository } from './application/ports/municipal-consolidation.repository';
import { PrismaMunicipalConsolidationRepository } from './infrastructure/prisma-municipal-consolidation.repository';
import { MunicipalConsolidationsController } from './http/municipal-consolidations.controller';
import { RegionalConsolidationUseCase } from './application/regional-consolidation.use-case';
import { RegionalConsolidationRepository } from './application/ports/regional-consolidation.repository';
import { PrismaRegionalConsolidationRepository } from './infrastructure/prisma-regional-consolidation.repository';
import { RegionalConsolidationsController } from './http/regional-consolidations.controller';
import { NationalConsolidationUseCase } from './application/national-consolidation.use-case';
import { NationalConsolidationRepository } from './application/ports/national-consolidation.repository';
import { PrismaNationalConsolidationRepository } from './infrastructure/prisma-national-consolidation.repository';
import { NationalConsolidationsController } from './http/national-consolidations.controller';
import { TerritorialAnalyticsController } from './http/territorial-analytics.controller';
import { TerritorialAnalyticsUseCase } from './application/territorial-analytics.use-case';
import { TerritorialAnalyticsRepository } from './application/ports/territorial-analytics.repository';
import { PrismaTerritorialAnalyticsRepository } from './infrastructure/prisma-territorial-analytics.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [
    ItsAttentionsController,
    ItsReportsController,
    MunicipalConsolidationsController,
    RegionalConsolidationsController,
    NationalConsolidationsController,
    TerritorialAnalyticsController,
  ],
  providers: [
    CreateAttentionUseCase,
    ListAttentionsUseCase,
    UpdateAttentionUseCase,
    CancelAttentionUseCase,
    MunicipalConsolidationUseCase,
    RegionalConsolidationUseCase,
    NationalConsolidationUseCase,
    TerritorialAnalyticsUseCase,
    GetCaptureContextUseCase,
    GetMonthlyReportUseCase,
    RenderIts2PdfUseCase,
    RenderIts1PdfUseCase,
    ItsReportWorkflowUseCase,
    { provide: ItsAttentionRepository, useClass: PrismaItsAttentionRepository },
    { provide: ItsReportWorkflowRepository, useClass: PrismaItsReportWorkflowRepository },
    {
      provide: MunicipalConsolidationRepository,
      useClass: PrismaMunicipalConsolidationRepository,
    },
    {
      provide: RegionalConsolidationRepository,
      useClass: PrismaRegionalConsolidationRepository,
    },
    {
      provide: NationalConsolidationRepository,
      useClass: PrismaNationalConsolidationRepository,
    },
    {
      provide: TerritorialAnalyticsRepository,
      useClass: PrismaTerritorialAnalyticsRepository,
    },
  ],
})
export class ItsCaptureModule {}
