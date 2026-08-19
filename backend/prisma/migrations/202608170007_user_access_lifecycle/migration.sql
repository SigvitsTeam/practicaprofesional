INSERT INTO "permisos" ("codigo", "modulo", "accion", "descripcion") VALUES
  ('admin:users:update', 'admin', 'update_users', 'Suspender, reactivar y cambiar el acceso de usuarios de menor jerarquía.');

INSERT INTO "rol_permiso" ("rol_id", "permiso_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permisos" p
WHERE r."codigo" IN ('SUPERADMIN', 'SUPERADMIN_REGIONAL')
  AND p."codigo" = 'admin:users:update';
