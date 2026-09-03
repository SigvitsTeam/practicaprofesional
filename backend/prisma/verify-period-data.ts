import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

async function verify(): Promise<void> {
  const url = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!url) throw new Error('DIRECT_URL o DATABASE_URL es obligatoria.');
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url, connectionTimeoutMillis: 5_000 }),
  });
  try {
    const periods = await client.reportingPeriod.findMany({
      where: { type: 'MENSUAL' },
      select: { year: true, month: true, startDate: true, endDate: true },
    });
    const counts = new Map<string, number>();
    for (const period of periods)
      counts.set(
        `${period.year}-${period.month}`,
        (counts.get(`${period.year}-${period.month}`) ?? 0) + 1,
      );
    const result = {
      duplicateGroups: [...counts.values()].filter((count) => count > 1).length,
      invalidMonthlyPeriods: periods.filter(
        (period) =>
          period.month === null ||
          period.month < 1 ||
          period.month > 12 ||
          period.year < 2020 ||
          period.year > 2100 ||
          period.endDate < period.startDate,
      ).length,
    };
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result.duplicateGroups || result.invalidMonthlyPeriods) process.exitCode = 1;
  } finally {
    await client.$disconnect();
  }
}

verify().catch((error: unknown) => {
  const failure = error as {
    name?: unknown;
    code?: unknown;
    clientVersion?: unknown;
    cause?: { name?: unknown; message?: unknown; code?: unknown };
  };
  const diagnostic = {
    name: typeof failure?.name === 'string' ? failure.name : 'Error',
    code: typeof failure?.code === 'string' ? failure.code : undefined,
    clientVersion: typeof failure?.clientVersion === 'string' ? failure.clientVersion : undefined,
    cause:
      failure?.cause && typeof failure.cause === 'object'
        ? {
            name: typeof failure.cause.name === 'string' ? failure.cause.name : undefined,
            code: typeof failure.cause.code === 'string' ? failure.cause.code : undefined,
            message: typeof failure.cause.message === 'string' ? failure.cause.message : undefined,
          }
        : undefined,
  };
  const message = error instanceof Error ? error.message : 'Error desconocido';
  process.stderr.write(`${message}\n${JSON.stringify(diagnostic)}\n`);
  process.exitCode = 1;
});
