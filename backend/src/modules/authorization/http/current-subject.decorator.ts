import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { RequestWithContext } from '../../../common/http/request-context';
import type { AuthorizationSubject } from '../domain/authorization.types';

export const CurrentSubject = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthorizationSubject => {
    const request = context.switchToHttp().getRequest<RequestWithContext>();
    if (!request.auth) throw new Error('Authenticated subject was not attached to the request.');
    return request.auth;
  },
);
