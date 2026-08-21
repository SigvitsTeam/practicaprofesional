import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { ItsCaptureModule } from '../its-capture/its-capture.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { ExportJobsUseCase } from './application/export-jobs.use-case';
import { DownloadExportArtifactUseCase } from './application/download-export-artifact.use-case';
import { ConsolidatedExportGenerator } from './application/consolidated-export.generator';
import { ExportArtifactGenerator } from './application/export-artifact.generator';
import { ExportWorkerService } from './application/export-worker.service';
import { ExportArtifactStorage } from './application/ports/export-artifact.storage';
import { ExportJobRepository } from './application/ports/export-job.repository';
import { TerritorialExportGenerator } from './application/territorial-export.generator';
import { Its2ExportGenerator } from './application/its2-export.generator';
import { Its1ExportGenerator } from './application/its1-export.generator';
import { ExportJobsController } from './http/export-jobs.controller';
import { PrismaExportJobRepository } from './infrastructure/prisma-export-job.repository';
import { FilesystemExportArtifactStorage } from './infrastructure/filesystem-export-artifact.storage';

@Module({
  imports: [DatabaseModule, ItsCaptureModule, AuthorizationModule],
  controllers: [ExportJobsController],
  providers: [
    ExportJobsUseCase,
    DownloadExportArtifactUseCase,
    ExportWorkerService,
    ExportArtifactGenerator,
    ConsolidatedExportGenerator,
    TerritorialExportGenerator,
    Its2ExportGenerator,
    Its1ExportGenerator,
    { provide: ExportJobRepository, useClass: PrismaExportJobRepository },
    { provide: ExportArtifactStorage, useClass: FilesystemExportArtifactStorage },
  ],
  exports: [ExportWorkerService],
})
export class ExportsModule {}
