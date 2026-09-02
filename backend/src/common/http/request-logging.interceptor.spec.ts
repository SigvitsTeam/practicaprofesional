import { Logger, type ExecutionContext } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { firstValueFrom, of } from 'rxjs';
import type { RequestWithContext } from './request-context';
import { RequestIdMiddleware } from './request-id.middleware';
import { RequestLoggingInterceptor } from './request-logging.interceptor';

describe('Request timing', () => {
  afterEach(() => jest.restoreAllMocks());

  it('timestamps requests before authentication and preserves safe correlation IDs', () => {
    jest.spyOn(performance, 'now').mockReturnValue(100);
    const request = { header: () => 'qa-request' } as unknown as RequestWithContext;
    const setHeader = jest.fn();
    const response = { setHeader } as unknown as Response;
    const next = jest.fn() as NextFunction;
    new RequestIdMiddleware().use(request as Request, response, next);
    expect(request.startedAt).toBe(100);
    expect(request.requestId).toBe('qa-request');
    expect(setHeader).toHaveBeenCalledWith('x-request-id', 'qa-request');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('includes guard time in durationMs without logging query parameters', async () => {
    jest.spyOn(performance, 'now').mockReturnValue(850);
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const request = {
      startedAt: 100,
      requestId: 'qa',
      method: 'GET',
      originalUrl: '/api/v1/auth/me?private=value',
    };
    const context = {
      switchToHttp: () => ({
        getRequest: (): typeof request => request,
        getResponse: (): Pick<Response, 'statusCode'> => ({ statusCode: 200 }),
      }),
    } as unknown as ExecutionContext;
    await firstValueFrom(
      new RequestLoggingInterceptor().intercept(context, { handle: () => of('ok') }),
    );
    expect(log).toHaveBeenCalledWith(
      'requestId=qa method=GET path=/api/v1/auth/me status=200 durationMs=750',
    );
  });
});
