import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type PeriodStatus } from '../src/generated/prisma/client';

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`La variable ${name} es obligatoria.`);
  return value;
}

async function setStatus(): Promise<void> {
  const databaseUrl = process.env.DIRECT_URL?.trim() || requiredEnvironment('DATABASE_URL');
  const year = Number(requiredEnvironment('PERIOD_YEAR'));
  const month = Number(requiredEnvironment('PERIOD_MONTH'));
  const status = requiredEnvironment('PERIOD_STATUS').toUpperCase() as PeriodStatus;
  const reason = requiredEnvironment('PERIOD_REASON');
  const actorEmail = (
    process.env.PERIOD_ACTOR_EMAIL?.trim() || requiredEnvironment('BOOTSTRAP_ADMIN_EMAIL')
  ).toLowerCase();
  if (!Number.isInteger(year) || year < 2020 || year > 2100)
    throw new Error('PERIOD_YEAR no es válido.');
  if (!Number.isInteger(month) || month < 1 || month > 12)
    throw new Error('PERIOD_MONTH no es válido.');
  if (!['ABIERTO', 'CERRADO', 'BLOQUEADO'].includes(status))
    throw new Error('PERIOD_STATUS no es válido.');

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    const actor = await prisma.appUser.findFirst({
      where: { email: actorEmail, active: true },
      select: {
        id: true,
        roles: {
          where: { active: true, endDate: null },
          select: { role: { select: { code: true } } },
        },
      },
    });
    const allowedRoles = new Set(['SUPERADMIN', 'ADMIN_CENTRAL']);
    if (!actor || !actor.roles.some((item) => allowedRoles.has(item.role.code)))
      throw new Error('El actor no está autorizado para administrar períodos nacionales.');
    const period = await prisma.reportingPeriod.findFirst({
      where: { type: 'MENSUAL', year, month },
      select: { id: true, status: true },
    });
    if (!period)
      throw new Error(`No existe el período mensual ${year}-${String(month).padStart(2, '0')}.`);
    if (period.status === status) {
      process.stdout.write(`${JSON.stringify({ year, month, status, unchanged: true })}\n`);
      return;
    }
    const transitions: Record<PeriodStatus, readonly PeriodStatus[]> = {
      BLOQUEADO: ['ABIERTO'],
      ABIERTO: ['CERRADO', 'BLOQUEADO'],
      CERRADO: [],
    };
    if (!transitions[period.status].includes(status))
      throw new Error(`Transición no permitida: ${period.status} -> ${status}.`);
    await prisma.$transaction(async (transaction) => {
      await transaction.reportingPeriod.update({ where: { id: period.id }, data: { status } });
      await transaction.auditEvent.create({
        data: {
          actorUserId: actor.id,
          action: 'PERIODO_MENSUAL_ESTADO_CAMBIADO',
          entity: 'periodos',
          entityId: period.id,
          dataLevel: 'CONFIGURACION',
          previousData: { year, month, status: period.status },
          newData: { year, month, status },
          reason,
        },
      });
    });
    process.stdout.write(
      `${JSON.stringify({ year, month, previousStatus: period.status, status })}\n`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

setStatus().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Error desconocido'}\n`);
  process.exitCode = 1;
});
