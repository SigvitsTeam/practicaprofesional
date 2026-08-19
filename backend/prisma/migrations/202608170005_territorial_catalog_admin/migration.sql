INSERT INTO "permisos" ("codigo", "modulo", "accion", "descripcion") VALUES
  ('territorial:catalog:read', 'territorial', 'read_catalog', 'Consultar municipios y establecimientos dentro del alcance asignado.'),
  ('territorial:municipalities:create', 'territorial', 'create_municipality', 'Crear municipios dentro del alcance administrativo.'),
  ('territorial:facilities:create', 'territorial', 'create_facility', 'Crear establecimientos dentro del alcance administrativo.');

INSERT INTO "rol_permiso" ("rol_id", "permiso_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permisos" p
WHERE r."codigo" IN ('SUPERADMIN', 'SUPERADMIN_REGIONAL')
  AND p."codigo" IN ('territorial:catalog:read', 'territorial:municipalities:create', 'territorial:facilities:create');

INSERT INTO "rol_permiso" ("rol_id", "permiso_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permisos" p
WHERE r."codigo" IN ('ADMIN_CENTRAL', 'ADMIN_REGIONAL', 'COORDINADOR_MUNICIPAL', 'SUPERVISOR_CONSULTA')
  AND p."codigo" = 'territorial:catalog:read';
