INSERT INTO "permisos" ("codigo", "modulo", "accion", "descripcion") VALUES
  ('audit:territorial:read', 'audit', 'read', 'Consultar eventos administrativos territoriales dentro del alcance autorizado.');

INSERT INTO "rol_permiso" ("rol_id", "permiso_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permisos" p
WHERE r."codigo" IN ('SUPERADMIN', 'SUPERADMIN_REGIONAL', 'ADMIN_REGIONAL')
  AND p."codigo" = 'audit:territorial:read';
