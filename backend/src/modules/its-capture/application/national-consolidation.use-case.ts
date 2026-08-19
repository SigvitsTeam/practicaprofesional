import { Injectable } from '@nestjs/common';
import type { AuthorizationSubject } from '../../authorization/domain/authorization.types';
import {
  NationalConsolidationAccessError,
  type NationalConsolidationContext,
  type NationalConsolidationSummary,
} from '../domain/national-consolidation';
import { NationalConsolidationRepository } from './ports/national-consolidation.repository';

@Injectable()
export class NationalConsolidationUseCase {
  constructor(private readonly repository: NationalConsolidationRepository) {}

  getContext(subject: AuthorizationSubject): Promise<NationalConsolidationContext> {
    this.requireNational(subject);
    return this.repository.getContext();
  }

  getCurrent(
    year: number,
    month: number,
    subject: AuthorizationSubject,
  ): Promise<NationalConsolidationSummary | undefined> {
    this.requireNational(subject);
    return this.repository.getCurrent({ year, month });
  }

  prepare(
    input: { year: number; month: number; comment?: string },
    subject: AuthorizationSubject,
  ): Promise<NationalConsolidationSummary> {
    this.requireNational(subject);
    return this.repository.prepare({ ...input, userId: subject.userId });
  }

  finalize(
    reportId: string,
    comment: string | undefined,
    subject: AuthorizationSubject,
  ): Promise<NationalConsolidationSummary> {
    this.requireNational(subject);
    return this.repository.finalize(reportId, subject.userId, comment);
  }

  close(
    reportId: string,
    reason: string,
    subject: AuthorizationSubject,
  ): Promise<NationalConsolidationSummary> {
    this.requireNational(subject);
    return this.repository.close(reportId, subject.userId, reason);
  }

  reopen(
    reportId: string,
    reason: string,
    subject: AuthorizationSubject,
  ): Promise<NationalConsolidationSummary> {
    this.requireNational(subject);
    return this.repository.reopen(reportId, subject.userId, reason);
  }

  private requireNational(subject: AuthorizationSubject): void {
    if (!subject.territory.national)
      throw new NationalConsolidationAccessError('La operación requiere alcance nacional.');
  }
}
