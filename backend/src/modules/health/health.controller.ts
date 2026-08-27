import { Controller, Get, ServiceUnavailableException, VERSION_NEUTRAL } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { Public } from '../authorization/http/public.decorator';

interface HealthResponse {
  status: 'ok';
  service: 'sigvits-api';
  uptimeSeconds: number;
  timestamp: string;
}

interface ReadinessResponse {
  status: 'ready';
  dependencies: { database: 'up' };
  timestamp: string;
}

@Controller({ path: 'health', version: VERSION_NEUTRAL })
@Public()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @SkipThrottle()
  check(): HealthResponse {
    return {
      status: 'ok',
      service: 'sigvits-api',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  @SkipThrottle()
  liveness(): HealthResponse {
    return this.check();
  }

  @Get('ready')
  @SkipThrottle()
  async readiness(): Promise<ReadinessResponse> {
    try {
      await this.withTimeout(
        this.prisma.client.$queryRaw`SELECT 1`,
        this.config.getOrThrow<number>('app.readinessTimeoutMs'),
      );
      return {
        status: 'ready',
        dependencies: { database: 'up' },
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException('Las dependencias del servicio no están disponibles.');
    }
  }

  private async withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('READINESS_TIMEOUT')), timeoutMs);
      timer.unref();
    });
    try {
      return await Promise.race([operation, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
