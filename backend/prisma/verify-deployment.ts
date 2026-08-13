import 'dotenv/config';
import { Client } from 'pg';

const protectedTables = [
  'programas_salud',
  'regiones',
  'redes_salud',
  'municipios',
  'red_municipios',
  'establecimientos_salud',
  'auditoria_eventos',
  'usuarios',
  'identidades_externas',
  'roles',
  'permisos',
  'rol_permiso',
  'usuario_roles',
  'usuario_asignaciones',
] as const;

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`La variable ${name} es obligatoria.`);
  return value;
}

async function verify(): Promise<void> {
  const directClient = new Client({
    connectionString: requiredEnvironment('DIRECT_URL'),
    connectionTimeoutMillis: 5_000,
  });
  const runtimeClient = new Client({
    connectionString: requiredEnvironment('DATABASE_URL'),
    connectionTimeoutMillis: 5_000,
  });

  try {
    await directClient.connect();
    const result = await directClient.query<{
      total: number;
      hardened: number;
      publiclyReadable: number;
    }>(
      `SELECT
         count(*)::int AS total,
         count(*) FILTER (WHERE c.relrowsecurity AND c.relforcerowsecurity)::int AS hardened,
         count(*) FILTER (
           WHERE has_table_privilege('anon', format('public.%I', c.relname), 'SELECT')
              OR has_table_privilege('authenticated', format('public.%I', c.relname), 'SELECT')
         )::int AS "publiclyReadable"
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])`,
      [[...protectedTables]],
    );
    const deployment = result.rows[0];
    if (
      !deployment ||
      deployment.total !== protectedTables.length ||
      deployment.hardened !== protectedTables.length ||
      deployment.publiclyReadable !== 0
    ) {
      throw new Error('La validación de tablas o RLS no coincide con la política esperada.');
    }

    await runtimeClient.connect();
    await runtimeClient.query('SELECT 1');

    const jwksResponse = await fetch(requiredEnvironment('AUTH_JWKS_URL'), {
      signal: AbortSignal.timeout(5_000),
    });
    const jwks: unknown = await jwksResponse.json();
    const keyCount =
      typeof jwks === 'object' && jwks !== null && 'keys' in jwks && Array.isArray(jwks.keys)
        ? jwks.keys.length
        : 0;
    if (!jwksResponse.ok || keyCount === 0) {
      throw new Error('El endpoint JWKS no publicó claves verificables.');
    }

    process.stdout.write(
      `${JSON.stringify({
        database: 'ok',
        runtimePooler: 'ok',
        protectedTables: deployment.total,
        rlsForced: deployment.hardened,
        publiclyReadable: deployment.publiclyReadable,
        jwksKeys: keyCount,
      })}\n`,
    );
  } finally {
    await Promise.allSettled([directClient.end(), runtimeClient.end()]);
  }
}

verify().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Error desconocido de verificación.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
