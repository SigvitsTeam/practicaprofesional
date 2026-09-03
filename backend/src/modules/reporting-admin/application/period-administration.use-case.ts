import { Injectable } from '@nestjs/common';
import {
  RoleCode,
  type AuthorizationSubject,
} from '../../authorization/domain/authorization.types';
import { PeriodAdministrationRepository } from './period-administration.repository';
import {
  PeriodAccessError,
  PeriodAdministrationError,
  validateCalendarYear,
  type CalendarCreationResult,
  type AnnualOpeningResult,
  type ManagedPeriod,
  type PeriodAudit,
  type PeriodChangeContext,
} from '../domain/calendar';

export interface PeriodCommand {
  reason: string;
  confirmNationalScope: boolean;
  requestId: string;
}

@Injectable()
export class PeriodAdministrationUseCase {
  constructor(private readonly repository: PeriodAdministrationRepository) {}

  list(year: number, subject: AuthorizationSubject): Promise<ManagedPeriod[]> {
    this.authorize(subject);
    validateCalendarYear(year);
    return this.repository.list(year);
  }
  create(
    year: number,
    command: PeriodCommand,
    subject: AuthorizationSubject,
  ): Promise<CalendarCreationResult> {
    this.authorize(subject);
    validateCalendarYear(year);
    return this.repository.createCalendar(year, this.context(command, subject));
  }
  open(
    id: string,
    expectedUpdatedAt: string,
    command: PeriodCommand,
    subject: AuthorizationSubject,
  ): Promise<ManagedPeriod> {
    this.authorize(subject);
    const context = this.context(command, subject);
    const version = new Date(expectedUpdatedAt);
    if (!Number.isFinite(version.getTime()))
      throw new PeriodAdministrationError('La versión del período no es válida.');
    return this.repository.open(id, version, context);
  }
  history(id: string, subject: AuthorizationSubject): Promise<PeriodAudit[]> {
    this.authorize(subject);
    return this.repository.history(id);
  }
  openYear(
    year: number,
    expectedPeriods: { id: string; updatedAt: string }[],
    command: PeriodCommand,
    subject: AuthorizationSubject,
  ): Promise<AnnualOpeningResult> {
    this.authorize(subject);
    validateCalendarYear(year);
    const context = this.context(command, subject);
    if (expectedPeriods.length !== 12 || new Set(expectedPeriods.map((p) => p.id)).size !== 12)
      throw new PeriodAdministrationError(
        'Debe confirmar los doce meses del calendario seleccionado.',
      );
    const versions = expectedPeriods.map((p) => ({ id: p.id, updatedAt: new Date(p.updatedAt) }));
    if (versions.some((p) => !Number.isFinite(p.updatedAt.getTime())))
      throw new PeriodAdministrationError('La versión de un período no es válida.');
    return this.repository.openYear(year, versions, context);
  }
  private authorize(subject: AuthorizationSubject): void {
    if (
      !subject.territory.national ||
      !subject.roles.some((r) => r === RoleCode.SuperAdmin || r === RoleCode.CentralAdmin) ||
      !subject.permissions.some((p) => p === 'reporting:periods:manage' || p === '*')
    )
      throw new PeriodAccessError(
        'La administración de períodos requiere permiso nacional de SuperAdmin o Admin Central.',
      );
  }
  private context(command: PeriodCommand, subject: AuthorizationSubject): PeriodChangeContext {
    const reason = command.reason.trim();
    if (command.confirmNationalScope !== true)
      throw new PeriodAdministrationError('Debe confirmar que la operación afecta a todo el país.');
    if (reason.length < 10 || reason.length > 500)
      throw new PeriodAdministrationError('El motivo debe tener entre 10 y 500 caracteres.');
    return { actorUserId: subject.userId, reason, requestId: command.requestId };
  }
}
