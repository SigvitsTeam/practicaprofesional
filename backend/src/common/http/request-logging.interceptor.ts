import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { finalize, type Observable } from 'rxjs';
import type { RequestWithContext } from './request-context';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithContext>();
    const response = http.getResponse<Response>();
    // Middleware runs before guards, so authentication latency is included.
    const startedAt = request.startedAt ?? performance.now();
    const safePath = request.originalUrl.split('?')[0] ?? request.path;

    return next.handle().pipe(
      finalize(() => {
        const durationMs = Math.round(performance.now() - startedAt);
        this.logger.log(
          `requestId=${request.requestId} method=${request.method} path=${safePath} status=${response.statusCode} durationMs=${durationMs}`,
        );
      }),
    );
  }
}
