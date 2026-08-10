import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { CreateRegionUseCase } from './application/create-region.use-case';
import { ListActiveRegionsUseCase } from './application/list-active-regions.use-case';
import { RegionRepository } from './application/ports/region.repository';
import { PrismaRegionRepository } from './infrastructure/prisma-region.repository';
import { RegionsController } from './http/regions.controller';

@Module({
  imports: [DatabaseModule],
  providers: [
    CreateRegionUseCase,
    ListActiveRegionsUseCase,
    { provide: RegionRepository, useClass: PrismaRegionRepository },
  ],
  controllers: [RegionsController],
  exports: [CreateRegionUseCase, ListActiveRegionsUseCase],
})
export class TerritorialModule {}
