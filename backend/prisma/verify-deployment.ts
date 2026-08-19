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
  'clasificaciones_its',
  'enfermedades_its',
  'grupos_edad',
  'grupos_edad_comparativo',
  'tipos_poblacion',
  'semanas_epidemiologicas',
  'periodos',
  'atenciones_its',
  'diagnosticos_atencion',
  'reportes_its',
  'reporte_its_detalle',
  'reporte_flujo_historial',
  'observaciones_reporte',
  'reporte_fuentes',
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
    const workflowPermissions = await directClient.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM permisos WHERE codigo = ANY($1::text[])`,
      [
        [
          'its2:reports:read',
          'its2:reports:prepare',
          'its2:reports:submit',
          'its2:reports:review',
          'its2:municipal:prepare',
          'its2:municipal:submit',
          'its2:regional:review',
          'its2:regional:prepare',
          'its2:regional:submit',
          'its2:central:review',
          'its2:national:prepare',
          'its2:national:close',
          'its2:national:reopen',
        ],
      ],
    );
    if (workflowPermissions.rows[0]?.total !== 13)
      throw new Error('No están disponibles todos los permisos del flujo ITS-2.');
    const its1Permissions = await directClient.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM permisos WHERE codigo = ANY($1::text[])`,
      [
        [
          'its1:attentions:read',
          'its1:attentions:create',
          'its1:attentions:update',
          'its1:attentions:cancel',
        ],
      ],
    );
    if (its1Permissions.rows[0]?.total !== 4)
      throw new Error('No están disponibles todos los permisos operativos de ITS-1.');
    const analyticsPermissions = await directClient.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM permisos WHERE codigo = ANY($1::text[])`,
      [['analytics:territorial:read']],
    );
    if (analyticsPermissions.rows[0]?.total !== 1)
      throw new Error('No está disponible el permiso de analítica territorial.');
    const territorialPermissions = await directClient.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM permisos WHERE codigo = ANY($1::text[])`,
      [
        [
          'territorial:catalog:read',
          'territorial:municipalities:create',
          'territorial:facilities:create',
          'territorial:networks:read',
          'territorial:networks:create',
          'territorial:networks:update',
          'territorial:status:update',
        ],
      ],
    );
    if (territorialPermissions.rows[0]?.total !== 7)
      throw new Error('No están disponibles todos los permisos de administración territorial.');
    const userAdminPermissions = await directClient.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM permisos WHERE codigo = ANY($1::text[])`,
      [['admin:users:read', 'admin:users:create', 'admin:users:update']],
    );
    if (userAdminPermissions.rows[0]?.total !== 3)
      throw new Error('No están disponibles todos los permisos de administración de usuarios.');
    const operators = await directClient.query<{ roleCode: string; total: number }>(
      `SELECT r.codigo AS "roleCode", count(DISTINCT u.id) FILTER (WHERE ie.id IS NOT NULL)::int AS total
       FROM roles r
       LEFT JOIN usuario_roles ur ON ur.rol_id = r.id AND ur.activo = true AND ur.fecha_fin IS NULL
       LEFT JOIN usuarios u ON u.id = ur.usuario_id AND u.activo = true
       LEFT JOIN identidades_externas ie ON ie.usuario_id = u.id
       WHERE r.codigo = ANY($1::text[])
       GROUP BY r.codigo
       ORDER BY r.codigo`,
      [['COORDINADOR_MUNICIPAL', 'DIGITADOR_COORDINACION', 'RESPONSABLE_ESTABLECIMIENTO']],
    );

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
        its2WorkflowPermissions: workflowPermissions.rows[0].total,
        its1Permissions: its1Permissions.rows[0].total,
        analyticsPermissions: analyticsPermissions.rows[0].total,
        territorialPermissions: territorialPermissions.rows[0].total,
        userAdminPermissions: userAdminPermissions.rows[0].total,
        activeOperators: Object.fromEntries(
          operators.rows.map((operator) => [operator.roleCode, operator.total]),
        ),
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
