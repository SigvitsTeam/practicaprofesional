import { ArgumentsHost, Catch, HttpException, Logger, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import type { RequestWithContext } from './request-context';

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  requestId: string;
  timestamp: string;
  errors?: string[];
}

const STATUS_TITLES: Readonly<Record<number, string>> = {
  400: 'Solicitud inválida',
  401: 'No autenticado',
  403: 'Acceso denegado',
  404: 'Recurso no encontrado',
  409: 'Conflicto',
  413: 'Carga demasiado grande',
  429: 'Demasiadas solicitudes',
  500: 'Error interno del servidor',
  503: 'Servicio no disponible',
};

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithContext>();
    const response = http.getResponse<Response>();
    const isExpectedHttpError = exception instanceof HttpException;
    const status = isExpectedHttpError ? exception.getStatus() : 500;
    const safePath = request.originalUrl.split('?')[0] ?? request.path;
    const exceptionResponse = isExpectedHttpError ? exception.getResponse() : undefined;
    const errors = this.extractValidationErrors(exceptionResponse);
    const detail = isExpectedHttpError
      ? this.extractDetail(exceptionResponse)
      : 'Ocurrió un error inesperado.';

    if (!isExpectedHttpError) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        `Unhandled error requestId=${request.requestId} method=${request.method} path=${safePath}`,
        stack,
      );
    }

    const problem: ProblemDetails = {
      type: `https://httpstatuses.com/${status}`,
      title: STATUS_TITLES[status] ?? 'Error en la solicitud',
      status,
      detail,
      instance: safePath,
      requestId: request.requestId,
      timestamp: new Date().toISOString(),
      ...(errors.length > 0 ? { errors } : {}),
    };

    response.status(status).type('application/problem+json').json(problem);
  }

  private extractValidationErrors(exceptionResponse: string | object | undefined): string[] {
    if (typeof exceptionResponse !== 'object' || exceptionResponse === null) return [];
    const message: unknown = (exceptionResponse as Record<string, unknown>)['message'];
    return Array.isArray(message) && message.every((item) => typeof item === 'string')
      ? message
      : [];
  }

  private extractDetail(exceptionResponse: string | object | undefined): string {
    if (typeof exceptionResponse === 'string') return exceptionResponse;
    if (typeof exceptionResponse !== 'object' || exceptionResponse === null)
      return 'Solicitud rechazada.';
    const message: unknown = (exceptionResponse as Record<string, unknown>)['message'];
    return typeof message === 'string' ? message : 'La solicitud contiene datos inválidos.';
  }
}
