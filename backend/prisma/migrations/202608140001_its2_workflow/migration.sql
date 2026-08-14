CREATE TYPE "ItsReportType" AS ENUM ('ITS2_MENSUAL');
CREATE TYPE "ItsReportLevel" AS ENUM ('ESTABLECIMIENTO', 'MUNICIPAL', 'REGIONAL', 'NACIONAL');
CREATE TYPE "ItsReportStatus" AS ENUM (
  'BORRADOR',
  'ENVIADO_A_MUNICIPIO',
  'DEVUELTO_POR_MUNICIPIO',
  'APROBADO_MUNICIPIO',
  'ENVIADO_A_REGION',
  'DEVUELTO_POR_REGION',
  'APROBADO_REGION',
  'ENVIADO_A_CENTRAL',
  'DEVUELTO_POR_CENTRAL',
  'APROBADO_CENTRAL',
  'CONSOLIDADO_NACIONAL',
  'CERRADO_OFICIAL',
  'REABIERTO_AUTORIZADO'
);
CREATE TYPE "ReportObservationStatus" AS ENUM ('ABIERTA', 'RESUELTA', 'RECHAZADA');

CREATE TABLE "reportes_its" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "programa_id" uuid NOT NULL REFERENCES "programas_salud"("id") ON DELETE RESTRICT,
  "periodo_id" uuid NOT NULL REFERENCES "periodos"("id") ON DELETE RESTRICT,
  "tipo_reporte" "ItsReportType" NOT NULL,
  "nivel" "ItsReportLevel" NOT NULL,
  "region_id" uuid REFERENCES "regiones"("id") ON DELETE RESTRICT,
  "municipio_id" uuid REFERENCES "municipios"("id") ON DELETE RESTRICT,
  "establecimiento_id" uuid REFERENCES "establecimientos_salud"("id") ON DELETE RESTRICT,
  "estado" "ItsReportStatus" NOT NULL DEFAULT 'BORRADOR',
  "version" integer NOT NULL DEFAULT 1,
  "es_version_actual" boolean NOT NULL DEFAULT true,
  "generado_por" uuid NOT NULL REFERENCES "usuarios"("id") ON DELETE RESTRICT,
  "enviado_por" uuid REFERENCES "usuarios"("id") ON DELETE RESTRICT,
  "aprobado_por" uuid REFERENCES "usuarios"("id") ON DELETE RESTRICT,
  "cerrado_por" uuid REFERENCES "usuarios"("id") ON DELETE RESTRICT,
  "fecha_generacion" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fecha_envio" timestamptz(3),
  "fecha_aprobacion" timestamptz(3),
  "fecha_cierre" timestamptz(3),
  "comentario_actual" varchar(1000),
  "atenciones_menor_15" integer,
  "atenciones_15_mas" integer,
  "fuente_total_atenciones" varchar(300),
  "totales_atenciones_completos" boolean NOT NULL DEFAULT false,
  "cantidad_atenciones_fuente" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ck_reportes_version" CHECK ("version" >= 1),
  CONSTRAINT "ck_reportes_cantidad_atenciones_fuente" CHECK ("cantidad_atenciones_fuente" >= 0),
  CONSTRAINT "ck_reportes_totales_atenciones" CHECK (
    ("atenciones_menor_15" IS NULL OR "atenciones_menor_15" >= 0) AND
    ("atenciones_15_mas" IS NULL OR "atenciones_15_mas" >= 0)
  ),
  CONSTRAINT "ck_reportes_nivel_territorio" CHECK (
    ("nivel" = 'ESTABLECIMIENTO' AND "establecimiento_id" IS NOT NULL AND "municipio_id" IS NOT NULL AND "region_id" IS NOT NULL) OR
    ("nivel" = 'MUNICIPAL' AND "establecimiento_id" IS NULL AND "municipio_id" IS NOT NULL AND "region_id" IS NOT NULL) OR
    ("nivel" = 'REGIONAL' AND "establecimiento_id" IS NULL AND "municipio_id" IS NULL AND "region_id" IS NOT NULL) OR
    ("nivel" = 'NACIONAL' AND "establecimiento_id" IS NULL AND "municipio_id" IS NULL AND "region_id" IS NULL)
  ),
  CONSTRAINT "uq_reportes_periodo_establecimiento_version" UNIQUE ("periodo_id", "establecimiento_id", "version")
);

CREATE UNIQUE INDEX "uq_reporte_actual_establecimiento"
  ON "reportes_its"("periodo_id", "establecimiento_id")
  WHERE "es_version_actual" = true AND "nivel" = 'ESTABLECIMIENTO';
CREATE INDEX "idx_reportes_nivel_estado_actual" ON "reportes_its"("nivel", "estado", "es_version_actual");
CREATE INDEX "idx_reportes_territorio_periodo" ON "reportes_its"("region_id", "municipio_id", "periodo_id");

CREATE TABLE "reporte_its_detalle" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "reporte_id" uuid NOT NULL REFERENCES "reportes_its"("id") ON DELETE CASCADE,
  "enfermedad_id" uuid NOT NULL REFERENCES "enfermedades_its"("id") ON DELETE RESTRICT,
  "grupo_edad_id" uuid REFERENCES "grupos_edad"("id") ON DELETE RESTRICT,
  "sexo" "BiologicalSex",
  "tipo_poblacion_id" uuid REFERENCES "tipos_poblacion"("id") ON DELETE RESTRICT,
  "tipo_caso" "CaseType",
  "es_contacto" boolean,
  "esta_embarazada" boolean,
  "total" integer NOT NULL,
  CONSTRAINT "ck_reporte_detalle_total" CHECK ("total" >= 0)
);
CREATE INDEX "idx_reporte_detalle_reporte_enfermedad" ON "reporte_its_detalle"("reporte_id", "enfermedad_id");

CREATE TABLE "reporte_flujo_historial" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "reporte_id" uuid NOT NULL REFERENCES "reportes_its"("id") ON DELETE CASCADE,
  "estado_anterior" "ItsReportStatus",
  "estado_nuevo" "ItsReportStatus" NOT NULL,
  "usuario_id" uuid NOT NULL REFERENCES "usuarios"("id") ON DELETE RESTRICT,
  "comentario" varchar(1000),
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "idx_reporte_flujo_reporte_fecha" ON "reporte_flujo_historial"("reporte_id", "created_at");

CREATE TABLE "observaciones_reporte" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "reporte_id" uuid NOT NULL REFERENCES "reportes_its"("id") ON DELETE CASCADE,
  "usuario_id" uuid NOT NULL REFERENCES "usuarios"("id") ON DELETE RESTRICT,
  "nivel_origen" "ItsReportLevel" NOT NULL,
  "comentario" varchar(1000) NOT NULL,
  "estado" "ReportObservationStatus" NOT NULL DEFAULT 'ABIERTA',
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "idx_observaciones_reporte_estado" ON "observaciones_reporte"("reporte_id", "estado");

INSERT INTO "permisos" ("codigo", "modulo", "accion", "descripcion") VALUES
  ('its2:reports:read', 'its2', 'read', 'Consultar reportes ITS 2 dentro del alcance autorizado.'),
  ('its2:reports:prepare', 'its2', 'prepare', 'Preparar o recalcular el ITS 2 de un establecimiento autorizado.'),
  ('its2:reports:submit', 'its2', 'submit', 'Enviar el ITS 2 de un establecimiento a coordinación municipal.'),
  ('its2:reports:review', 'its2', 'review', 'Devolver o aprobar reportes ITS 2 agregados en coordinación municipal.');

INSERT INTO "rol_permiso" ("rol_id", "permiso_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permisos" p
WHERE r."codigo" IN ('DIGITADOR_COORDINACION', 'RESPONSABLE_ESTABLECIMIENTO')
  AND p."codigo" IN ('its2:reports:read', 'its2:reports:prepare', 'its2:reports:submit');

INSERT INTO "rol_permiso" ("rol_id", "permiso_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permisos" p
WHERE r."codigo" = 'COORDINADOR_MUNICIPAL'
  AND p."codigo" IN ('its2:reports:read', 'its2:reports:review');

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['reportes_its', 'reporte_its_detalle', 'reporte_flujo_historial', 'observaciones_reporte']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon', table_name);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM authenticated', table_name);
  END LOOP;
END $$;
