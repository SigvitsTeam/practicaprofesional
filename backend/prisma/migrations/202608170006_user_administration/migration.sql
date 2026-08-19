CREATE UNIQUE INDEX "uq_usuario_asignacion_actual"
  ON "usuario_asignaciones" (
    "usuario_id", "tipo_alcance",
    COALESCE("region_id", '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE("municipio_id", '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE("establecimiento_id", '00000000-0000-0000-0000-000000000000'::uuid)
  ) WHERE "activo" = true AND "fecha_fin" IS NULL;

INSERT INTO "permisos" ("codigo", "modulo", "accion", "descripcion") VALUES
  ('admin:users:read', 'admin', 'read_users', 'Consultar usuarios dentro del alcance administrativo.'),
  ('admin:users:create', 'admin', 'create_users', 'Crear perfiles, roles y asignaciones territoriales de menor jerarquía.');

INSERT INTO "rol_permiso" ("rol_id", "permiso_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permisos" p
WHERE r."codigo" IN ('SUPERADMIN', 'SUPERADMIN_REGIONAL')
  AND p."codigo" IN ('admin:users:read', 'admin:users:create');
