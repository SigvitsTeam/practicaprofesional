import { Controller, Get, ServiceUnavailableException, VERSION_NEUTRAL } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { Public } from '../authorization/http/public.decorator';

interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

interface ReadinessResponse {
  status: 'ready';
  timestamp: string;
}

@Controller({ path: 'health', version: VERSION_NEUTRAL })
@Public()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @SkipThrottle()
  check(): HealthResponse {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @SkipThrottle()
  async readiness(): Promise<ReadinessResponse> {
    try {
      await this.prisma.client.$queryRaw`SELECT 1`;
      return { status: 'ready', timestamp: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException('Las dependencias del servicio no están disponibles.');
    }
  }
}
