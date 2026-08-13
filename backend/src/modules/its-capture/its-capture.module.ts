import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { CreateAttentionUseCase } from './application/create-attention.use-case';
import { ItsAttentionRepository } from './application/ports/its-attention.repository';
import { ItsAttentionsController } from './http/its-attentions.controller';
import { PrismaItsAttentionRepository } from './infrastructure/prisma-its-attention.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [ItsAttentionsController],
  providers: [
    CreateAttentionUseCase,
    { provide: ItsAttentionRepository, useClass: PrismaItsAttentionRepository },
  ],
})
export class ItsCaptureModule {}
