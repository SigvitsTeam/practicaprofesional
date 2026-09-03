import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { PeriodAdministrationRepository } from './application/period-administration.repository';
import { PeriodAdministrationUseCase } from './application/period-administration.use-case';
import { PeriodAdministrationController } from './http/period-administration.controller';
import { PrismaPeriodAdministrationRepository } from './infrastructure/prisma-period-administration.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [PeriodAdministrationController],
  providers: [
    PeriodAdministrationUseCase,
    { provide: PeriodAdministrationRepository, useClass: PrismaPeriodAdministrationRepository },
  ],
})
export class ReportingAdminModule {}
