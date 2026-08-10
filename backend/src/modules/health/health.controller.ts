import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  @Get()
  @SkipThrottle()
  check(): HealthResponse {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
