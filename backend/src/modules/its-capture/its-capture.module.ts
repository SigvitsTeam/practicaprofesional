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

@Module({
  imports: [DatabaseModule],
  controllers: [ItsAttentionsController, ItsReportsController],
  providers: [
    CreateAttentionUseCase,
    GetCaptureContextUseCase,
    GetMonthlyReportUseCase,
    RenderIts2PdfUseCase,
    RenderIts1PdfUseCase,
    ItsReportWorkflowUseCase,
    { provide: ItsAttentionRepository, useClass: PrismaItsAttentionRepository },
    { provide: ItsReportWorkflowRepository, useClass: PrismaItsReportWorkflowRepository },
  ],
})
export class ItsCaptureModule {}
