INSERT INTO "permisos" ("codigo", "modulo", "accion", "descripcion") VALUES
  ('its1:attentions:cancel', 'its1', 'cancel', 'Anular atenciones ITS 1 dentro del establecimiento y período autorizados.');

INSERT INTO "rol_permiso" ("rol_id", "permiso_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permisos" p
WHERE r."codigo" IN ('DIGITADOR_COORDINACION', 'RESPONSABLE_ESTABLECIMIENTO')
  AND p."codigo" = 'its1:attentions:cancel';
