INSERT INTO "permisos" ("codigo", "modulo", "accion", "descripcion") VALUES
  ('territorial:status:update', 'territorial', 'update_status', 'Cambiar estados territoriales con validación de dependencias y auditoría.');

INSERT INTO "rol_permiso" ("rol_id", "permiso_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permisos" p
WHERE r."codigo" IN ('SUPERADMIN', 'SUPERADMIN_REGIONAL')
  AND p."codigo" = 'territorial:status:update';
