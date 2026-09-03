import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../../src/generated/prisma/client';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { PrismaPeriodAdministrationRepository } from '../../src/modules/reporting-admin/infrastructure/prisma-period-administration.repository';
import {
  annualCalendar,
  PeriodConflictError,
} from '../../src/modules/reporting-admin/domain/calendar';
import { createQaClient, requireQaDatabaseUrl } from './qa-database';

function service(client: PrismaClient): PrismaService {
  return { client } as PrismaService;
}

describe('Administración de períodos PostgreSQL', () => {
  const year = 2097;
  const marker = `QA-PERIODS-${randomUUID()}`;
  let left: PrismaClient;
  let right: PrismaClient;
  let actorId: string | undefined;
  let createdPeriodIds: string[] = [];
  let createdWeekIds: string[] = [];
  const weekKeys = annualCalendar(year).weeks.map(({ year: weekYear, weekNumber }) => ({
    year: weekYear,
    weekNumber,
  }));

  beforeAll(async () => {
    const url = requireQaDatabaseUrl(process.env.QA_DATABASE_URL);
    left = createQaClient();
    right = createQaClient();
    const identity = await left.$queryRaw<Array<{ database: string }>>`
      SELECT current_database() AS database
    `;
    expect(identity[0]?.database).toBe(url.pathname.slice(1));
    const existing = await left.reportingPeriod.count({ where: { type: 'MENSUAL', year } });
    if (existing !== 0)
      throw new Error(`El año sintético ${year} debe estar vacío en la base desechable de QA.`);
    if ((await left.epidemiologicalWeek.count({ where: { OR: weekKeys } })) !== 0)
      throw new Error('Las semanas sintéticas deben estar vacías antes de ejecutar QA.');
    const actor = await left.appUser.create({
      data: { fullName: marker, email: `${marker.toLowerCase()}@example.invalid` },
    });
    actorId = actor.id;
  });

  afterAll(async () => {
    try {
      if (actorId) {
        await left.auditEvent.deleteMany({ where: { actorUserId: actorId } });
        if (createdPeriodIds.length)
          await left.reportingPeriod.deleteMany({ where: { id: { in: createdPeriodIds } } });
        if (createdWeekIds.length)
          await left.epidemiologicalWeek.deleteMany({ where: { id: { in: createdWeekIds } } });
        await left.appUser.delete({ where: { id: actorId } });
      }
    } finally {
      await Promise.allSettled([left?.$disconnect(), right?.$disconnect()]);
    }
  });

  it('serializa dos creaciones concurrentes sin duplicar meses ni auditoría', async () => {
    if (!actorId) throw new Error('Actor QA no disponible.');
    const context = {
      actorUserId: actorId,
      reason: 'Creación sintética concurrente del calendario nacional de QA',
      requestId: marker,
    };
    const outcomes = await Promise.allSettled([
      new PrismaPeriodAdministrationRepository(service(left)).createCalendar(year, context),
      new PrismaPeriodAdministrationRepository(service(right)).createCalendar(year, context),
    ]);
    const periods = await left.reportingPeriod.findMany({
      where: { type: 'MENSUAL', year },
      orderBy: { month: 'asc' },
    });
    createdPeriodIds = periods.map(({ id }) => id);
    createdWeekIds = (
      await left.epidemiologicalWeek.findMany({
        where: { OR: weekKeys },
        select: { id: true },
      })
    ).map(({ id }) => id);
    const values = outcomes.map((outcome) => {
      if (outcome.status === 'rejected') throw outcome.reason;
      return outcome.value;
    });
    expect(values.reduce((sum, value) => sum + value.createdMonths, 0)).toBe(12);
    expect(values.reduce((sum, value) => sum + value.createdWeeks, 0)).toBe(weekKeys.length);
    expect(periods).toHaveLength(12);
    expect(periods.map(({ month }) => month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(periods.every(({ status }) => status === 'BLOQUEADO')).toBe(true);
    expect(
      await left.auditEvent.count({
        where: { actorUserId: actorId, action: 'PERIODO_MENSUAL_CREADO' },
      }),
    ).toBe(12);
    expect(
      await left.auditEvent.count({
        where: { actorUserId: actorId, action: 'CALENDARIO_EPIDEMIOLOGICO_CREADO' },
      }),
    ).toBe(1);
  });

  it('permite una sola apertura concurrente y registra una sola auditoría', async () => {
    if (!actorId) throw new Error('Actor QA no disponible.');
    const periods = await new PrismaPeriodAdministrationRepository(service(left)).list(year);
    expect(periods).toHaveLength(12);
    expect(periods.every(({ calendarReady }) => calendarReady)).toBe(true);
    const january = periods[0]!;
    const context = {
      actorUserId: actorId,
      reason: 'Apertura sintética concurrente autorizada exclusivamente para QA',
      requestId: `${marker}-open`,
    };
    const outcomes = await Promise.allSettled([
      new PrismaPeriodAdministrationRepository(service(left)).open(
        january.id,
        january.updatedAt,
        context,
      ),
      new PrismaPeriodAdministrationRepository(service(right)).open(
        january.id,
        january.updatedAt,
        context,
      ),
    ]);
    expect(outcomes.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
    expect(rejected?.reason).toBeInstanceOf(PeriodConflictError);
    expect(
      await left.auditEvent.count({
        where: {
          actorUserId: actorId,
          entityId: january.id,
          action: 'PERIODO_MENSUAL_ABIERTO',
        },
      }),
    ).toBe(1);
    expect(
      await left.reportingPeriod.findUniqueOrThrow({ where: { id: january.id } }),
    ).toMatchObject({ status: 'ABIERTO' });
  });

  it('revierte la apertura si no puede persistir su auditoría', async () => {
    const repository = new PrismaPeriodAdministrationRepository(service(left));
    const period = (await repository.list(year)).find(({ month }) => month === 2)!;
    await expect(
      repository.open(period.id, period.updatedAt, {
        actorUserId: randomUUID(),
        reason: 'Fallo sintético del actor para verificar rollback de auditoría',
        requestId: marker,
      }),
    ).rejects.toThrow();
    expect(
      await left.reportingPeriod.findUniqueOrThrow({ where: { id: period.id } }),
    ).toMatchObject({
      status: 'BLOQUEADO',
      updatedAt: period.updatedAt,
    });
    expect(
      await left.auditEvent.count({
        where: { entityId: period.id, action: 'PERIODO_MENSUAL_ABIERTO' },
      }),
    ).toBe(0);
  });

  it('rechaza la apertura cuando faltan semanas activas', async () => {
    if (!actorId) throw new Error('Actor QA no disponible.');
    const repository = new PrismaPeriodAdministrationRepository(service(left));
    const period = (await repository.list(year)).find(({ month }) => month === 3)!;
    const week = await left.epidemiologicalWeek.findFirstOrThrow({
      where: {
        id: { in: createdWeekIds },
        startDate: { gte: period.startDate, lte: period.endDate },
      },
    });
    await left.epidemiologicalWeek.update({ where: { id: week.id }, data: { active: false } });
    try {
      await expect(
        repository.open(period.id, period.updatedAt, {
          actorUserId: actorId,
          reason: 'Apertura sintética de calendario incompleto para QA',
          requestId: marker,
        }),
      ).rejects.toBeInstanceOf(PeriodConflictError);
      expect(
        await left.reportingPeriod.findUniqueOrThrow({ where: { id: period.id } }),
      ).toMatchObject({
        status: 'BLOQUEADO',
      });
    } finally {
      await left.epidemiologicalWeek.update({ where: { id: week.id }, data: { active: true } });
    }
  });

  it('impide duplicados mensuales y bloquea por defecto desde la base', async () => {
    await expect(
      left.reportingPeriod.create({
        data: {
          type: 'MENSUAL',
          year,
          month: 1,
          startDate: new Date(`${year}-01-01`),
          endDate: new Date(`${year}-01-31`),
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    const period = await left.reportingPeriod.create({
      data: {
        type: 'MENSUAL',
        year: year - 1,
        month: 7,
        startDate: new Date(`${year - 1}-07-01`),
        endDate: new Date(`${year - 1}-07-31`),
      },
    });
    createdPeriodIds.push(period.id);
    expect(period.status).toBe('BLOQUEADO');
  });

  it('asigna el permiso de administración únicamente a los dos roles nacionales', async () => {
    const assignments = await left.rolePermission.findMany({
      where: { permission: { code: 'reporting:periods:manage' } },
      select: { role: { select: { code: true } } },
    });
    expect(assignments.map(({ role }) => role.code).sort()).toEqual([
      'ADMIN_CENTRAL',
      'SUPERADMIN',
    ]);
  });

  it('revierte toda la apertura anual si falla una auditoría o falta una semana activa', async () => {
    if (!actorId) throw new Error('Actor QA no disponible.');
    const repository = new PrismaPeriodAdministrationRepository(service(left));
    const periods = await repository.list(year);
    const versions = periods.map(({ id, updatedAt }) => ({ id, updatedAt }));
    const context = {
      actorUserId: actorId,
      reason: 'Apertura anual sintética para verificar atomicidad',
      requestId: `${marker}-annual`,
    };
    await expect(
      repository.openYear(year, versions, { ...context, actorUserId: randomUUID() }),
    ).rejects.toThrow();
    const week = await left.epidemiologicalWeek.findFirstOrThrow({
      where: {
        id: { in: createdWeekIds },
        startDate: { gte: new Date(`${year}-08-01`) },
      },
    });
    await left.epidemiologicalWeek.update({ where: { id: week.id }, data: { active: false } });
    try {
      await expect(repository.openYear(year, versions, context)).rejects.toBeInstanceOf(
        PeriodConflictError,
      );
    } finally {
      await left.epidemiologicalWeek.update({ where: { id: week.id }, data: { active: true } });
    }
    expect(
      await left.reportingPeriod.count({
        where: { id: { in: createdPeriodIds }, year, status: 'ABIERTO' },
      }),
    ).toBe(1);
    expect(await left.auditEvent.count({ where: { requestId: context.requestId } })).toBe(0);
  });

  it('abre el año una sola vez bajo concurrencia y no reabre un cierre oficial', async () => {
    if (!actorId) throw new Error('Actor QA no disponible.');
    const repository = new PrismaPeriodAdministrationRepository(service(left));
    const march = await left.reportingPeriod.findFirstOrThrow({
      where: { type: 'MENSUAL', year, month: 3 },
    });
    await left.reportingPeriod.update({ where: { id: march.id }, data: { status: 'CERRADO' } });
    const versions = (await repository.list(year)).map(({ id, updatedAt }) => ({ id, updatedAt }));
    const context = {
      actorUserId: actorId,
      reason: 'Apertura anual sintética concurrente autorizada para QA',
      requestId: `${marker}-annual`,
    };
    const outcomes = await Promise.allSettled([
      repository.openYear(year, versions, context),
      new PrismaPeriodAdministrationRepository(service(right)).openYear(year, versions, context),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.find((outcome) => outcome.status === 'fulfilled')?.value).toEqual({
      openedMonths: 10,
      alreadyOpenMonths: 1,
      closedMonths: 1,
    });
    expect(outcomes.find((outcome) => outcome.status === 'rejected')?.reason).toBeInstanceOf(
      PeriodConflictError,
    );
    expect(await left.reportingPeriod.findUniqueOrThrow({ where: { id: march.id } })).toMatchObject(
      { status: 'CERRADO' },
    );
    expect(await left.auditEvent.count({ where: { requestId: context.requestId } })).toBe(10);
    const refreshed = (await repository.list(year)).map(({ id, updatedAt }) => ({ id, updatedAt }));
    expect(await repository.openYear(year, refreshed, context)).toEqual({
      openedMonths: 0,
      alreadyOpenMonths: 11,
      closedMonths: 1,
    });
    expect(await left.auditEvent.count({ where: { requestId: context.requestId } })).toBe(10);
  });
});
