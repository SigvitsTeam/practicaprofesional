import { Prisma } from '../../../generated/prisma/client';
import type {
  RoleCode,
  TerritorialScopeType,
} from '../../authorization/domain/authorization.types';

export interface ManagedUserListRow {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  active: boolean;
  hasExternalIdentity: boolean;
  createdAt: Date;
  updatedAt: Date;
  roleCode: RoleCode;
  roleName: string;
  roleStartDate: Date;
  scopeType: TerritorialScopeType;
  regionId: string | null;
  municipalityId: string | null;
  facilityId: string | null;
  scopeLabel: string;
  scopeStartDate: Date;
}

export function managedUserListQuery(today: Date, regionIds?: readonly string[]): Prisma.Sql {
  const ids = regionIds?.length
    ? Prisma.join(regionIds.map((id) => Prisma.sql`${id}::uuid`))
    : null;
  const scopeFilter =
    regionIds === undefined
      ? Prisma.sql`TRUE`
      : ids
        ? Prisma.sql`(a.region_id IN (${ids}) OR m.region_id IN (${ids}) OR fm.region_id IN (${ids}))`
        : Prisma.sql`FALSE`;

  return Prisma.sql`
    SELECT u.id, u.nombre_completo AS "fullName", u.email, u.telefono AS phone,
      u.activo AS active, u.created_at AS "createdAt", u.updated_at AS "updatedAt",
      EXISTS(SELECT 1 FROM identidades_externas i WHERE i.usuario_id = u.id) AS "hasExternalIdentity",
      r.codigo AS "roleCode", r.nombre AS "roleName", r.fecha_inicio AS "roleStartDate",
      a.tipo_alcance::text AS "scopeType", a.region_id AS "regionId",
      a.municipio_id AS "municipalityId", a.establecimiento_id AS "facilityId",
      a.label AS "scopeLabel", a.fecha_inicio AS "scopeStartDate"
    FROM usuarios u
    JOIN LATERAL (
      SELECT r.codigo, r.nombre, ur.fecha_inicio
      FROM usuario_roles ur JOIN roles r ON r.id = ur.rol_id
      WHERE ur.usuario_id = u.id AND ur.activo AND ur.fecha_inicio <= ${today}::date
        AND (ur.fecha_fin IS NULL OR ur.fecha_fin >= ${today}::date)
      ORDER BY ur.fecha_inicio DESC, ur.created_at DESC, ur.id DESC LIMIT 1
    ) r ON TRUE
    JOIN LATERAL (
      SELECT a.tipo_alcance, a.region_id, a.municipio_id, a.establecimiento_id, a.fecha_inicio,
        COALESCE(r.nombre, m.nombre, f.nombre, 'Honduras') AS label
      FROM usuario_asignaciones a
      LEFT JOIN regiones r ON r.id = a.region_id
      LEFT JOIN municipios m ON m.id = a.municipio_id
      LEFT JOIN establecimientos_salud f ON f.id = a.establecimiento_id
      LEFT JOIN municipios fm ON fm.id = f.municipio_id
      WHERE a.usuario_id = u.id AND a.activo AND a.fecha_inicio <= ${today}::date
        AND (a.fecha_fin IS NULL OR a.fecha_fin >= ${today}::date)
        AND ${scopeFilter}
      ORDER BY a.fecha_inicio DESC, a.created_at DESC, a.id DESC LIMIT 1
    ) a ON TRUE
    ORDER BY u.nombre_completo, u.email, u.id
  `;
}
