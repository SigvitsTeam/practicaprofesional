import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import { MetricsService } from '../observability/metrics.service';
import type { RequestWithContext } from './request-context';

@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(request: RequestWithContext, response: Response, next: NextFunction): void {
    const startedAt = performance.now();
    let recorded = false;
    this.metrics.beginHttpRequest();
    const record = (): void => {
      if (recorded) return;
      recorded = true;
      this.metrics.endHttpRequest(
        request.method,
        this.routeLabel(request),
        response.statusCode,
        (performance.now() - startedAt) / 1_000,
      );
    };
    response.once('finish', record);
    response.once('close', record);
    next();
  }

  private routeLabel(request: RequestWithContext): string {
    const route = request.route as { path?: unknown } | undefined;
    if (typeof route?.path === 'string') return `${request.baseUrl}${route.path}` || '/';
    return '<unmatched>';
  }
}
