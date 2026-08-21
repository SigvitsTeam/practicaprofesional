import { Controller, Get } from '@nestjs/common';
import { DataLevel, type AuthorizationSubject } from '../domain/authorization.types';
import { CurrentSubject } from './current-subject.decorator';
import { RequireAccess } from './require-access.decorator';

@Controller('auth')
export class CurrentProfileController {
  @Get('me')
  @RequireAccess({
    permission: 'auth:profile:read',
    dataLevel: DataLevel.Configuration,
    scope: 'OWN',
  })
  get(@CurrentSubject() subject: AuthorizationSubject): AuthorizationSubject {
    return subject;
  }
}
