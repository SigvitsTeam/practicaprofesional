import { Prisma } from '../../../generated/prisma/client';

export interface AuthorizationSubjectRow {
  userId: string;
  displayName: string;
  roles: string[];
  permissions: string[];
  national: boolean;
  regionIds: string[];
  regionGrantIds: string[];
  municipalityIds: string[];
  facilityIds: string[];
}

/** Resolve fresh grants in one database round trip; never cache authorization. */
export function authorizationSubjectQuery(
  issuer: string,
  subject: string,
  today: Date,
): Prisma.Sql {
  return Prisma.sql`
    WITH identity_user AS (
      SELECT u.id, u.nombre_completo
      FROM identidades_externas i
      JOIN usuarios u ON u.id = i.usuario_id AND u.activo
      WHERE i.emisor = ${issuer} AND i.sujeto = ${subject}
    ), current_roles AS (
      SELECT r.id, r.codigo, ur.created_at, ur.id AS assignment_id
      FROM usuario_roles ur
      JOIN identity_user u ON u.id = ur.usuario_id
      JOIN roles r ON r.id = ur.rol_id
      WHERE ur.activo AND ur.fecha_inicio <= ${today}::date
        AND (ur.fecha_fin IS NULL OR ur.fecha_fin >= ${today}::date)
    ), current_assignments AS (
      SELECT a.tipo_alcance, a.region_id, a.municipio_id, a.establecimiento_id
      FROM usuario_asignaciones a
      JOIN identity_user u ON u.id = a.usuario_id
      WHERE a.activo AND a.fecha_inicio <= ${today}::date
        AND (a.fecha_fin IS NULL OR a.fecha_fin >= ${today}::date)
    ), municipality_grants AS (
      SELECT m.id, m.region_id
      FROM current_assignments a
      JOIN municipios m ON m.region_id = a.region_id
      WHERE m.activo
      UNION
      SELECT m.id, m.region_id
      FROM current_assignments a
      JOIN municipios m ON m.id = a.municipio_id
    ), direct_facilities AS (
      -- Parent IDs provide context, not a grant to sibling facilities.
      SELECT f.id, f.municipio_id, m.region_id
      FROM current_assignments a
      JOIN establecimientos_salud f ON f.id = a.establecimiento_id
      JOIN municipios m ON m.id = f.municipio_id
    )
    SELECT u.id AS "userId", u.nombre_completo AS "displayName",
      ARRAY(SELECT codigo FROM current_roles ORDER BY created_at, assignment_id) AS roles,
      ARRAY(
        SELECT DISTINCT p.codigo FROM current_roles r
        JOIN rol_permiso rp ON rp.rol_id = r.id
        JOIN permisos p ON p.id = rp.permiso_id AND p.activo
        ORDER BY p.codigo
      ) AS permissions,
      EXISTS(SELECT 1 FROM current_assignments WHERE tipo_alcance = 'NACIONAL') AS national,
      ARRAY(
        SELECT region_id::text FROM current_assignments WHERE region_id IS NOT NULL
        UNION SELECT region_id::text FROM municipality_grants
        UNION SELECT region_id::text FROM direct_facilities
      ) AS "regionIds",
      ARRAY(
        SELECT DISTINCT region_id::text FROM current_assignments
        WHERE tipo_alcance = 'REGION' AND region_id IS NOT NULL
      ) AS "regionGrantIds",
      ARRAY(
        SELECT id::text FROM municipality_grants
        UNION SELECT municipio_id::text FROM direct_facilities
      ) AS "municipalityIds",
      ARRAY(
        SELECT f.id::text FROM municipality_grants m
        JOIN establecimientos_salud f ON f.municipio_id = m.id WHERE f.activo
        UNION SELECT id::text FROM direct_facilities
      ) AS "facilityIds"
    FROM identity_user u
  `;
}
