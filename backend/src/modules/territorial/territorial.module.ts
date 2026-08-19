import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { CreateRegionUseCase } from './application/create-region.use-case';
import { ListActiveRegionsUseCase } from './application/list-active-regions.use-case';
import { RegionRepository } from './application/ports/region.repository';
import { PrismaRegionRepository } from './infrastructure/prisma-region.repository';
import { RegionsController } from './http/regions.controller';
import { TerritorialCatalogRepository } from './application/ports/territorial-catalog.repository';
import { TerritorialCatalogUseCase } from './application/territorial-catalog.use-case';
import { PrismaTerritorialCatalogRepository } from './infrastructure/prisma-territorial-catalog.repository';
import { TerritorialCatalogController } from './http/territorial-catalog.controller';
import { HealthNetworkRepository } from './application/ports/health-network.repository';
import { HealthNetworksUseCase } from './application/health-networks.use-case';
import { PrismaHealthNetworkRepository } from './infrastructure/prisma-health-network.repository';
import { HealthNetworksController } from './http/health-networks.controller';

@Module({
  imports: [DatabaseModule],
  providers: [
    CreateRegionUseCase,
    ListActiveRegionsUseCase,
    TerritorialCatalogUseCase,
    HealthNetworksUseCase,
    { provide: RegionRepository, useClass: PrismaRegionRepository },
    { provide: TerritorialCatalogRepository, useClass: PrismaTerritorialCatalogRepository },
    { provide: HealthNetworkRepository, useClass: PrismaHealthNetworkRepository },
  ],
  controllers: [RegionsController, TerritorialCatalogController, HealthNetworksController],
  exports: [CreateRegionUseCase, ListActiveRegionsUseCase],
})
export class TerritorialModule {}
