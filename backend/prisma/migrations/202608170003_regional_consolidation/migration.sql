INSERT INTO "permisos" ("codigo", "modulo", "accion", "descripcion") VALUES
  ('its2:regional:prepare', 'its2', 'prepare_regional', 'Preparar el consolidado regional desde consolidados municipales aprobados.'),
  ('its2:regional:submit', 'its2', 'submit_central', 'Enviar el consolidado regional a revisión central.'),
  ('its2:central:review', 'its2', 'review_central', 'Devolver o aprobar consolidados regionales a nivel central.');

INSERT INTO "rol_permiso" ("rol_id", "permiso_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permisos" p
WHERE r."codigo" IN ('ADMIN_REGIONAL', 'SUPERADMIN_REGIONAL')
  AND p."codigo" IN ('its2:regional:prepare', 'its2:regional:submit');

INSERT INTO "rol_permiso" ("rol_id", "permiso_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permisos" p
WHERE r."codigo" = 'ADMIN_CENTRAL'
  AND p."codigo" IN ('its2:reports:read', 'its2:central:review');
