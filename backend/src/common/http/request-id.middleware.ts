import { randomUUID } from 'node:crypto';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { RequestWithContext } from './request-context';

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    (request as RequestWithContext).startedAt = performance.now();
    const incomingRequestId = request.header('x-request-id');
    const requestId =
      incomingRequestId && SAFE_REQUEST_ID.test(incomingRequestId)
        ? incomingRequestId
        : randomUUID();

    (request as RequestWithContext).requestId = requestId;
    response.setHeader('x-request-id', requestId);
    next();
  }
}
