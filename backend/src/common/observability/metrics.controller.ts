import {
  Controller,
  Get,
  Header,
  Req,
  UnauthorizedException,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { Public } from '../../modules/authorization/http/public.decorator';
import { MetricsService } from './metrics.service';

@Controller({ path: 'metrics', version: VERSION_NEUTRAL })
@Public()
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @SkipThrottle()
  @Header('Cache-Control', 'no-store')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  collect(@Req() request: Request): string {
    const expected = this.config.get<string>('app.metricsBearerToken')?.trim();
    if (expected && !this.matchesBearer(request.header('authorization'), expected))
      throw new UnauthorizedException('Credenciales de métricas no válidas.');
    return this.metrics.render();
  }

  private matchesBearer(header: string | undefined, expected: string): boolean {
    if (!header?.startsWith('Bearer ')) return false;
    const actualBuffer = Buffer.from(header.slice(7), 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    return (
      actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
    );
  }
}
