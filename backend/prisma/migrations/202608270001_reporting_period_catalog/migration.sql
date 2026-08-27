INSERT INTO "permisos" ("codigo", "modulo", "accion", "descripcion")
VALUES (
  'reporting:periods:read',
  'reporting',
  'read',
  'Consultar el catálogo institucional de períodos mensuales.'
)
ON CONFLICT ("codigo") DO UPDATE SET
  "modulo" = EXCLUDED."modulo",
  "accion" = EXCLUDED."accion",
  "descripcion" = EXCLUDED."descripcion";

INSERT INTO "rol_permiso" ("rol_id", "permiso_id")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permisos" p
WHERE r."codigo" IN (
  'SUPERADMIN',
  'ADMIN_CENTRAL',
  'SUPERADMIN_REGIONAL',
  'ADMIN_REGIONAL',
  'COORDINADOR_MUNICIPAL',
  'DIGITADOR_COORDINACION',
  'RESPONSABLE_ESTABLECIMIENTO',
  'SUPERVISOR_CONSULTA'
)
  AND p."codigo" = 'reporting:periods:read'
ON CONFLICT DO NOTHING;
