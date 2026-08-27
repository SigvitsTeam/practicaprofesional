import { config } from 'dotenv';
import { Client } from 'pg';

config({ quiet: true });

const markerOrigin = 'Dato sintético de certificación automatizada';
const markerObservation = 'Registro sintético; debe quedar anulado al finalizar la prueba.';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`La variable ${name} es obligatoria.`);
  return value;
}

async function run(): Promise<void> {
  if (!process.argv.includes('--confirm'))
    throw new Error('La recuperación requiere el argumento explícito --confirm.');

  const client = new Client({
    connectionString: required('DIRECT_URL'),
    connectionTimeoutMillis: 5_000,
  });
  await client.connect();
  try {
    await client.query('BEGIN');
    const candidates = await client.query<{ total: number }>(
      `SELECT count(*)::int AS total
       FROM atenciones_its
       WHERE estado = 'ACTIVO'
         AND numero_expediente LIKE 'SMOKE-%'
         AND procedencia_texto = $1
         AND observacion = $2
         AND created_at >= now() - interval '24 hours'`,
      [markerOrigin, markerObservation],
    );
    const total = candidates.rows[0]?.total ?? 0;
    if (total > 10)
      throw new Error(`La recuperación se detuvo: ${total} candidatos exceden el límite seguro.`);

    const recovered = await client.query<{ entityId: string }>(
      `WITH targets AS (
         UPDATE atenciones_its
         SET estado = 'ANULADO', updated_at = clock_timestamp()
         WHERE estado = 'ACTIVO'
           AND numero_expediente LIKE 'SMOKE-%'
           AND procedencia_texto = $1
           AND observacion = $2
           AND created_at >= now() - interval '24 hours'
         RETURNING id, usuario_registro_id
       )
       INSERT INTO auditoria_eventos (
         id, usuario_id, accion, entidad, entidad_id, nivel_dato,
         datos_anteriores, datos_nuevos, motivo, request_id, created_at
       )
       SELECT
         gen_random_uuid(), usuario_registro_id, 'ITS1_ATENCION_ANULADA_RECUPERACION_SMOKE',
         'atenciones_its', id, 'INDIVIDUAL',
         jsonb_build_object('status', 'ACTIVO'),
         jsonb_build_object('status', 'ANULADO', 'syntheticSmokeCleanup', true),
         'Recuperación controlada de registro sintético creado por smoke automatizado.',
         'smoke-its1-controlled-recovery', clock_timestamp()
       FROM targets
       RETURNING entidad_id AS "entityId"`,
      [markerOrigin, markerObservation],
    );

    const openPeriod = await client.query<{
      year: number;
      month: number;
      attentionDate: string;
    }>(
      `SELECT p.anio AS year, p.mes AS month,
              to_char(least(p.fecha_fin, current_date), 'YYYY-MM-DD') AS "attentionDate"
       FROM periodos p
       JOIN establecimientos_salud e ON e.codigo = '85481' AND e.activo = true
       WHERE p.tipo = 'MENSUAL'
         AND p.estado = 'ABIERTO'
         AND p.fecha_inicio <= current_date
         AND NOT EXISTS (
           SELECT 1 FROM reportes_its r
           WHERE r.establecimiento_id = e.id
             AND r.periodo_id = p.id
             AND r.tipo_reporte = 'ITS2_MENSUAL'
             AND r.nivel = 'ESTABLECIMIENTO'
             AND r.es_version_actual = true
             AND r.estado NOT IN ('BORRADOR', 'DEVUELTO_POR_MUNICIPIO')
         )
       ORDER BY p.fecha_fin DESC
       LIMIT 1`,
    );
    await client.query('COMMIT');
    process.stdout.write(
      `${JSON.stringify({
        syntheticRecordsRecovered: recovered.rowCount ?? 0,
        safeOpenPeriod: openPeriod.rows[0] ?? null,
      })}\n`,
    );
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Error desconocido'}\n`);
  process.exitCode = 1;
});
