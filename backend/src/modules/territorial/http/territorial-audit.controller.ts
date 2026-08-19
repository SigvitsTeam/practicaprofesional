import { Controller, ForbiddenException, Get, NotFoundException, Query } from '@nestjs/common';
import {
  DataLevel,
  type AuthorizationSubject,
} from '../../authorization/domain/authorization.types';
import { CurrentSubject } from '../../authorization/http/current-subject.decorator';
import { RequireAccess } from '../../authorization/http/require-access.decorator';
import { TerritorialAuditUseCase } from '../application/territorial-audit.use-case';
import {
  TerritorialAuditScopeDeniedError,
  TerritorialAuditTargetNotFoundError,
  type TerritorialAuditPage,
} from '../domain/territorial-audit';
import { TerritorialAuditQueryDto } from './territorial-audit.dto';

@Controller('territories/audit-events')
export class TerritorialAuditController {
  constructor(private readonly audit: TerritorialAuditUseCase) {}

  @Get()
  @RequireAccess({
    permission: 'audit:territorial:read',
    dataLevel: DataLevel.Configuration,
    scope: 'OWN',
  })
  async list(
    @Query() query: TerritorialAuditQueryDto,
    @CurrentSubject() subject: AuthorizationSubject,
  ): Promise<TerritorialAuditPage> {
    try {
      return await this.audit.listMunicipalityEvents(
        query.municipalityId,
        query.limit,
        query.cursor,
        subject,
      );
    } catch (error: unknown) {
      if (error instanceof TerritorialAuditTargetNotFoundError)
        throw new NotFoundException(error.message);
      if (error instanceof TerritorialAuditScopeDeniedError)
        throw new ForbiddenException(error.message);
      throw error;
    }
  }
}
