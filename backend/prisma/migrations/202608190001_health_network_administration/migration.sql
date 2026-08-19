CREATE UNIQUE INDEX "uq_red_municipio_actual"
  ON "red_municipios" ("red_id", "municipio_id", COALESCE("programa_id", '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE "activo" = true AND "fecha_fin" IS NULL;

INSERT INTO "permisos" ("codigo", "modulo", "accion", "descripcion") VALUES
  ('territorial:networks:read', 'territorial', 'read_networks', 'Consultar redes y su composición dentro del alcance asignado.'),
  ('territorial:networks:create', 'territorial', 'create_networks', 'Crear redes dentro del alcance administrativo.'),
  ('territorial:networks:update', 'territorial', 'update_networks', 'Cambiar de forma versionada la composición municipal de redes.');

INSERT INTO "rol_permiso" ("rol_id", "permiso_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permisos" p
WHERE r."codigo" IN ('SUPERADMIN', 'SUPERADMIN_REGIONAL')
  AND p."codigo" IN ('territorial:networks:read', 'territorial:networks:create', 'territorial:networks:update');

INSERT INTO "rol_permiso" ("rol_id", "permiso_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permisos" p
WHERE r."codigo" IN ('ADMIN_CENTRAL', 'ADMIN_REGIONAL', 'SUPERVISOR_CONSULTA')
  AND p."codigo" = 'territorial:networks:read';
