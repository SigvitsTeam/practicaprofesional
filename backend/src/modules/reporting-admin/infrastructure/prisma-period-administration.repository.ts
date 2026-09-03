import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { Prisma, type ReportingPeriod } from '../../../generated/prisma/client';
import { PeriodAdministrationRepository } from '../application/period-administration.repository';
import {
  annualCalendar,
  coversMonth,
  PeriodConflictError,
  PeriodNotFoundError,
  type ManagedPeriod,
  type PeriodChangeContext,
  type CalendarCreationResult,
  type PeriodAudit,
  type AnnualOpeningResult,
  type PeriodVersion,
} from '../domain/calendar';

@Injectable()
export class PrismaPeriodAdministrationRepository extends PeriodAdministrationRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async list(year: number): Promise<ManagedPeriod[]> {
    const [periods, weeks] = await Promise.all([
      this.prisma.client.reportingPeriod.findMany({
        where: { type: 'MENSUAL', year },
        orderBy: { month: 'asc' },
      }),
      this.prisma.client.epidemiologicalWeek.findMany({
        where: {
          startDate: { lte: new Date(Date.UTC(year, 11, 31)) },
          endDate: { gte: new Date(Date.UTC(year, 0, 1)) },
        },
      }),
    ]);
    return periods.map((p) => this.summary(p, coversMonth(p.startDate, p.endDate, weeks)));
  }

  async createCalendar(
    year: number,
    context: PeriodChangeContext,
  ): Promise<CalendarCreationResult> {
    const calendar = annualCalendar(year);
    return this.prisma.client.$transaction(
      async (tx) => {
        // Calendars overlap at year boundaries. Serialize only these rare administrative writes.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(20260903, 1)::text`;
        const existingWeeks = await tx.epidemiologicalWeek.findMany({
          where: {
            OR: calendar.weeks.map((w) => ({ year: w.year, weekNumber: w.weekNumber })),
          },
        });
        for (const current of existingWeeks) {
          const expected = calendar.weeks.find(
            (w) => w.year === current.year && w.weekNumber === current.weekNumber,
          )!;
          if (
            current.startDate.getTime() !== expected.startDate.getTime() ||
            current.endDate.getTime() !== expected.endDate.getTime() ||
            !current.active
          )
            throw new PeriodConflictError(
              'El calendario epidemiológico existente difiere del calendario OPS o está inactivo. Requiere revisión; no se modificaron fechas.',
            );
        }
        const existingMonths = await tx.reportingPeriod.findMany({
          where: { type: 'MENSUAL', year },
        });
        for (const current of existingMonths) {
          const expected = calendar.months.find((m) => m.month === current.month);
          if (
            !expected ||
            current.startDate.getTime() !== expected.startDate.getTime() ||
            current.endDate.getTime() !== expected.endDate.getTime()
          )
            throw new PeriodConflictError(
              'Las fechas mensuales existentes requieren revisión. No se sobrescribirán períodos.',
            );
        }
        const weeks = await tx.epidemiologicalWeek.createMany({
          data: calendar.weeks.filter(
            (w) => !existingWeeks.some((e) => e.year === w.year && e.weekNumber === w.weekNumber),
          ),
          skipDuplicates: true,
        });
        let createdMonths = 0;
        for (const month of calendar.months.filter(
          (m) => !existingMonths.some((e) => e.month === m.month),
        )) {
          const period = await tx.reportingPeriod.create({
            data: { ...month, type: 'MENSUAL', status: 'BLOQUEADO' },
          });
          createdMonths++;
          await tx.auditEvent.create({
            data: {
              ...context,
              action: 'PERIODO_MENSUAL_CREADO',
              entity: 'periodos',
              entityId: period.id,
              dataLevel: 'CONFIGURACION',
              newData: { year, month: month.month, status: 'BLOQUEADO' },
            },
          });
        }
        if (weeks.count)
          await tx.auditEvent.create({
            data: {
              ...context,
              action: 'CALENDARIO_EPIDEMIOLOGICO_CREADO',
              entity: 'calendarios',
              dataLevel: 'CONFIGURACION',
              newData: { year, createdWeeks: weeks.count, method: 'OPS_DOMINGO_CUATRO_DIAS' },
            },
          });
        return { createdMonths, createdWeeks: weeks.count };
      },
      { timeout: 15_000, maxWait: 5_000 },
    );
  }

  async open(
    id: string,
    expectedUpdatedAt: Date,
    context: PeriodChangeContext,
  ): Promise<ManagedPeriod> {
    return this.prisma.client.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT id FROM periodos WHERE id=${id}::uuid AND tipo='MENSUAL' FOR UPDATE`,
        );
        if (!rows.length) throw new PeriodNotFoundError('No existe el período mensual.');
        const current = await tx.reportingPeriod.findUniqueOrThrow({ where: { id } });
        if (current.updatedAt.getTime() !== expectedUpdatedAt.getTime())
          throw new PeriodConflictError(
            'El período cambió. Actualice el listado antes de confirmar nuevamente.',
          );
        if (current.status !== 'BLOQUEADO')
          throw new PeriodConflictError(
            'Sólo se pueden abrir períodos bloqueados. Los cierres oficiales se reabren desde Consolidados.',
          );
        const weeks = await tx.epidemiologicalWeek.findMany({
          where: {
            active: true,
            startDate: { lte: current.endDate },
            endDate: { gte: current.startDate },
          },
        });
        if (!coversMonth(current.startDate, current.endDate, weeks))
          throw new PeriodConflictError(
            'Faltan semanas epidemiológicas activas para cubrir el mes. Complete el calendario antes de abrirlo.',
          );
        await this.persistOpening(tx, current, context, 'MENSUAL');
        return this.summary(await tx.reportingPeriod.findUniqueOrThrow({ where: { id } }), true);
      },
      { timeout: 10_000, maxWait: 5_000 },
    );
  }

  async openYear(
    year: number,
    expectedPeriods: PeriodVersion[],
    context: PeriodChangeContext,
  ): Promise<AnnualOpeningResult> {
    const calendar = annualCalendar(year);
    return this.prisma.client.$transaction(
      async (tx) => {
        // Stable row ordering avoids deadlocks between two annual openings.
        await tx.$queryRaw`SELECT id FROM periodos WHERE tipo='MENSUAL' AND anio=${year}
        ORDER BY mes, id FOR UPDATE`;
        const periods = await tx.reportingPeriod.findMany({
          where: { type: 'MENSUAL', year },
          orderBy: { month: 'asc' },
        });
        const versions = new Map(expectedPeriods.map((p) => [p.id, p.updatedAt.getTime()]));
        if (periods.length !== 12 || expectedPeriods.length !== 12 || versions.size !== 12)
          throw new PeriodConflictError(
            'Complete el calendario de doce meses antes de abrir el año.',
          );
        for (const period of periods) {
          const expectedMonth = calendar.months.find((m) => m.month === period.month);
          if (
            !expectedMonth ||
            expectedMonth.startDate.getTime() !== period.startDate.getTime() ||
            expectedMonth.endDate.getTime() !== period.endDate.getTime()
          )
            throw new PeriodConflictError(
              'Las fechas del calendario requieren revisión antes de abrir el año.',
            );
          if (versions.get(period.id) !== period.updatedAt.getTime())
            throw new PeriodConflictError(
              'Un período cambió. Actualice el listado antes de abrir el año.',
            );
        }
        if (new Set(periods.map((p) => p.month)).size !== 12)
          throw new PeriodConflictError(
            'El calendario contiene meses duplicados; no se abrió ningún mes.',
          );
        const blocked = periods.filter((p) => p.status === 'BLOQUEADO');
        const weeks = await tx.epidemiologicalWeek.findMany({
          where: {
            active: true,
            startDate: { lte: new Date(Date.UTC(year, 11, 31)) },
            endDate: { gte: new Date(Date.UTC(year, 0, 1)) },
          },
        });
        if (blocked.some((p) => !coversMonth(p.startDate, p.endDate, weeks)))
          throw new PeriodConflictError(
            'Faltan semanas epidemiológicas activas. No se abrió ningún mes.',
          );
        for (const period of blocked) await this.persistOpening(tx, period, context, 'ANUAL');
        return {
          openedMonths: blocked.length,
          alreadyOpenMonths: periods.filter((p) => p.status === 'ABIERTO').length,
          closedMonths: periods.filter((p) => p.status === 'CERRADO').length,
        };
      },
      { timeout: 20_000, maxWait: 5_000 },
    );
  }

  private async persistOpening(
    tx: Prisma.TransactionClient,
    period: ReportingPeriod,
    context: PeriodChangeContext,
    mode: 'MENSUAL' | 'ANUAL',
  ): Promise<void> {
    const changed = await tx.reportingPeriod.updateMany({
      where: { id: period.id, status: 'BLOQUEADO', updatedAt: period.updatedAt },
      data: { status: 'ABIERTO' },
    });
    if (changed.count !== 1)
      throw new PeriodConflictError('El período cambió durante la apertura.');
    await tx.auditEvent.create({
      data: {
        ...context,
        action: 'PERIODO_MENSUAL_ABIERTO',
        entity: 'periodos',
        entityId: period.id,
        dataLevel: 'CONFIGURACION',
        previousData: { status: period.status },
        newData: { status: 'ABIERTO', year: period.year, month: period.month, mode },
      },
    });
  }

  async history(id: string): Promise<PeriodAudit[]> {
    if (
      !(await this.prisma.client.reportingPeriod.findFirst({
        where: { id, type: 'MENSUAL' },
        select: { id: true },
      }))
    )
      throw new PeriodNotFoundError('No existe el período mensual.');
    const events = await this.prisma.client.auditEvent.findMany({
      where: { entity: 'periodos', entityId: id },
      take: 50,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        action: true,
        reason: true,
        createdAt: true,
        actor: { select: { fullName: true } },
      },
    });
    return events.map(({ actor, ...event }) => ({ ...event, actorName: actor?.fullName ?? null }));
  }

  private summary(p: ReportingPeriod, calendarReady: boolean): ManagedPeriod {
    if (p.month === null) throw new PeriodConflictError('El período mensual no tiene mes.');
    return {
      id: p.id,
      year: p.year,
      month: p.month,
      startDate: p.startDate,
      endDate: p.endDate,
      status: p.status,
      updatedAt: p.updatedAt,
      calendarReady,
    };
  }
}
