import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

async function review(): Promise<void> {
  const url = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!url) throw new Error('No hay conexión configurada.');
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url, connectionTimeoutMillis: 5000 }),
  });
  try {
    const facilities = await client.healthFacility.findMany({ orderBy: { code: 'asc' } });
    const events = await client.auditEvent.findMany({
      where: {
        entity: { in: ['HEALTH_FACILITY', 'ESTABLECIMIENTO'] },
        entityId: { in: facilities.map((row) => row.id) },
        dataLevel: 'CONFIGURACION',
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, entityId: true, actorUserId: true, createdAt: true, newData: true },
    });
    for (const facility of facilities) {
      const event = events.find(
        (row) =>
          row.entityId === facility.id &&
          row.newData &&
          typeof row.newData === 'object' &&
          !Array.isArray(row.newData) &&
          typeof row.newData['coordinatesValidated'] === 'boolean',
      );
      const data = event?.newData as Record<string, unknown> | undefined;
      const hasEvidence =
        !!event?.actorUserId &&
        data?.coordinatesValidated === true &&
        typeof data.source === 'string' &&
        data.source.trim().length >= 10 &&
        typeof data.latitude === 'number' &&
        Number.isFinite(data.latitude) &&
        Math.abs(data.latitude) <= 90 &&
        typeof data.longitude === 'number' &&
        Number.isFinite(data.longitude) &&
        Math.abs(data.longitude) <= 180;
      const recoveryEligible = !facility.coordinatesValidated && hasEvidence;
      console.log(
        JSON.stringify({
          code: facility.code,
          name: facility.name,
          state:
            facility.latitude === null || facility.longitude === null
              ? 'SIN_COORDENADAS'
              : facility.coordinatesValidated
                ? 'VALIDADA'
                : 'REFERENCIA',
          recoveryEligible,
          evidenceEventId: hasEvidence ? event.id : undefined,
          source: hasEvidence ? data.source : undefined,
        }),
      );
    }
  } finally {
    await client.$disconnect();
  }
}

review().catch(() => {
  console.error(
    'No se pudo completar la revisión geográfica. Compruebe la conexión y los permisos; esta herramienta es de solo lectura.',
  );
  process.exitCode = 1;
});
