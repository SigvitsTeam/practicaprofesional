INSERT INTO "permisos" ("codigo", "modulo", "accion", "descripcion") VALUES
  ('admin:users:link', 'admin', 'link_external_identity', 'Vincular una identidad externa verificada a un perfil institucional de menor jerarquía.');

INSERT INTO "rol_permiso" ("rol_id", "permiso_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permisos" p
WHERE r."codigo" IN ('SUPERADMIN', 'SUPERADMIN_REGIONAL')
  AND p."codigo" = 'admin:users:link';
