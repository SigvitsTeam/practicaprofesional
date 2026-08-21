import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { ExportJobsUseCase } from './application/export-jobs.use-case';
import { ExportJobRepository } from './application/ports/export-job.repository';
import { ExportJobsController } from './http/export-jobs.controller';
import { PrismaExportJobRepository } from './infrastructure/prisma-export-job.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [ExportJobsController],
  providers: [
    ExportJobsUseCase,
    { provide: ExportJobRepository, useClass: PrismaExportJobRepository },
  ],
})
export class ExportsModule {}
