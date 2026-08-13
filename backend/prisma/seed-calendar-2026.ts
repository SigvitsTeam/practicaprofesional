import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const YEAR = 2026;
const FIRST_WEEK_START = new Date(Date.UTC(YEAR, 0, 4));

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`La variable ${name} es obligatoria.`);
  return value;
}

function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

async function seed(): Promise<void> {
  const adapter = new PrismaPg({ connectionString: requiredEnvironment('DIRECT_URL') });
  const prisma = new PrismaClient({ adapter });
  try {
    await prisma.$transaction(
      async (transaction) => {
        await transaction.epidemiologicalWeek.upsert({
          where: { year_weekNumber: { year: 2025, weekNumber: 53 } },
          update: {
            startDate: new Date(Date.UTC(2025, 11, 28)),
            endDate: new Date(Date.UTC(2026, 0, 3)),
            active: true,
          },
          create: {
            year: 2025,
            weekNumber: 53,
            startDate: new Date(Date.UTC(2025, 11, 28)),
            endDate: new Date(Date.UTC(2026, 0, 3)),
          },
        });

        for (let weekNumber = 1; weekNumber <= 52; weekNumber += 1) {
          const startDate = addUtcDays(FIRST_WEEK_START, (weekNumber - 1) * 7);
          const endDate = addUtcDays(startDate, 6);
          await transaction.epidemiologicalWeek.upsert({
            where: { year_weekNumber: { year: YEAR, weekNumber } },
            update: { startDate, endDate, active: true },
            create: { year: YEAR, weekNumber, startDate, endDate },
          });
        }

        for (let month = 1; month <= 12; month += 1) {
          const startDate = new Date(Date.UTC(YEAR, month - 1, 1));
          const endDate = new Date(Date.UTC(YEAR, month, 0));
          const existing = await transaction.reportingPeriod.findFirst({
            where: { type: 'MENSUAL', year: YEAR, month },
          });
          if (existing) continue;
          await transaction.reportingPeriod.create({
            data: { type: 'MENSUAL', year: YEAR, month, startDate, endDate, status: 'BLOQUEADO' },
          });
        }
      },
      { timeout: 30_000 },
    );
    process.stdout.write(
      `${JSON.stringify({ year: YEAR, epidemiologicalWeeks: 53, monthlyPeriods: 12, defaultPeriodStatus: 'BLOQUEADO' })}\n`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

seed().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Error desconocido'}\n`);
  process.exitCode = 1;
});
