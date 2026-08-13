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

@Module({
  imports: [DatabaseModule],
  controllers: [ItsAttentionsController],
  providers: [
    CreateAttentionUseCase,
    GetCaptureContextUseCase,
    GetMonthlyReportUseCase,
    RenderIts2PdfUseCase,
    RenderIts1PdfUseCase,
    { provide: ItsAttentionRepository, useClass: PrismaItsAttentionRepository },
  ],
})
export class ItsCaptureModule {}
