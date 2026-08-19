CREATE UNIQUE INDEX "uq_reportes_periodo_nacional_version"
  ON "reportes_its"("periodo_id", "version")
  WHERE "nivel" = 'NACIONAL';

CREATE UNIQUE INDEX "uq_reporte_actual_nacional"
  ON "reportes_its"("periodo_id")
  WHERE "es_version_actual" = true AND "nivel" = 'NACIONAL';

INSERT INTO "permisos" ("codigo", "modulo", "accion", "descripcion") VALUES
  ('its2:national:prepare', 'its2', 'prepare_national', 'Preparar y finalizar el consolidado nacional desde regiones aprobadas.'),
  ('its2:national:close', 'its2', 'close_national', 'Cerrar oficialmente un consolidado nacional y su período.'),
  ('its2:national:reopen', 'its2', 'reopen_national', 'Reabrir excepcionalmente un cierre nacional con motivo obligatorio.');

INSERT INTO "rol_permiso" ("rol_id", "permiso_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permisos" p
WHERE r."codigo" = 'ADMIN_CENTRAL'
  AND p."codigo" IN ('its2:national:prepare', 'its2:national:close', 'its2:national:reopen');
