INSERT INTO "permisos" ("codigo", "modulo", "accion", "descripcion") VALUES
  ('analytics:territorial:read', 'analytics', 'read', 'Consultar indicadores ITS agregados por territorio dentro del alcance autorizado.');

INSERT INTO "rol_permiso" ("rol_id", "permiso_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permisos" p
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
  AND p."codigo" = 'analytics:territorial:read';
