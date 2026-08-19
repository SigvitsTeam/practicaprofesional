CREATE UNIQUE INDEX "uq_reportes_periodo_municipio_version"
  ON "reportes_its"("periodo_id", "municipio_id", "version")
  WHERE "nivel" = 'MUNICIPAL';

CREATE UNIQUE INDEX "uq_reportes_periodo_region_version"
  ON "reportes_its"("periodo_id", "region_id", "version")
  WHERE "nivel" = 'REGIONAL';

CREATE UNIQUE INDEX "uq_reporte_actual_municipal"
  ON "reportes_its"("periodo_id", "municipio_id")
  WHERE "es_version_actual" = true AND "nivel" = 'MUNICIPAL';

CREATE UNIQUE INDEX "uq_reporte_actual_regional"
  ON "reportes_its"("periodo_id", "region_id")
  WHERE "es_version_actual" = true AND "nivel" = 'REGIONAL';

CREATE TABLE "reporte_fuentes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "reporte_id" uuid NOT NULL REFERENCES "reportes_its"("id") ON DELETE CASCADE,
  "reporte_fuente_id" uuid NOT NULL REFERENCES "reportes_its"("id") ON DELETE RESTRICT,
  "version_fuente" integer NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ck_reporte_fuente_version" CHECK ("version_fuente" >= 1),
  CONSTRAINT "ck_reporte_fuente_no_circular" CHECK ("reporte_id" <> "reporte_fuente_id"),
  CONSTRAINT "uq_reporte_fuente" UNIQUE ("reporte_id", "reporte_fuente_id")
);

CREATE INDEX "idx_reporte_fuente_origen" ON "reporte_fuentes"("reporte_fuente_id");

ALTER TABLE "reporte_fuentes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reporte_fuentes" FORCE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "reporte_fuentes" FROM anon;
REVOKE ALL PRIVILEGES ON TABLE "reporte_fuentes" FROM authenticated;

INSERT INTO "permisos" ("codigo", "modulo", "accion", "descripcion") VALUES
  ('its2:municipal:prepare', 'its2', 'prepare_municipal', 'Preparar el consolidado municipal desde reportes de establecimientos aprobados.'),
  ('its2:municipal:submit', 'its2', 'submit_region', 'Enviar el consolidado municipal a revisión regional.'),
  ('its2:regional:review', 'its2', 'review_regional', 'Devolver o aprobar consolidados municipales dentro de la región autorizada.');

INSERT INTO "rol_permiso" ("rol_id", "permiso_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permisos" p
WHERE r."codigo" = 'COORDINADOR_MUNICIPAL'
  AND p."codigo" IN ('its2:municipal:prepare', 'its2:municipal:submit');

INSERT INTO "rol_permiso" ("rol_id", "permiso_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permisos" p
WHERE r."codigo" IN ('ADMIN_REGIONAL', 'SUPERADMIN_REGIONAL')
  AND p."codigo" IN ('its2:reports:read', 'its2:regional:review');
