import { PrismaPg } from '@prisma/adapter-pg';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../../generated/prisma/client';
import { DatabaseNotConfiguredError } from './database.errors';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  private readonly databaseClient?: PrismaClient;

  constructor(config: ConfigService) {
    const connectionString = config.get<string>('database.url');
    if (!connectionString) return;

    const adapter = new PrismaPg({
      connectionString,
      max: config.getOrThrow<number>('database.poolMax'),
      connectionTimeoutMillis: config.getOrThrow<number>('database.connectionTimeoutMs'),
      idleTimeoutMillis: config.getOrThrow<number>('database.idleTimeoutMs'),
    });
    this.databaseClient = new PrismaClient({ adapter });
  }

  get client(): PrismaClient {
    if (!this.databaseClient) throw new DatabaseNotConfiguredError();
    return this.databaseClient;
  }

  get isConfigured(): boolean {
    return this.databaseClient !== undefined;
  }

  async onModuleDestroy(): Promise<void> {
    await this.databaseClient?.$disconnect();
  }
}
