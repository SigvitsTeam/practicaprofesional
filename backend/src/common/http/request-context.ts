import type { Request } from 'express';
import type { AuthorizationSubject } from '../../modules/authorization/domain/authorization.types';

export interface RequestWithContext extends Request {
  requestId: string;
  startedAt?: number;
  auth?: AuthorizationSubject;
}
