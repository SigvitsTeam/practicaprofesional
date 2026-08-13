CREATE TYPE "BiologicalSex" AS ENUM ('H', 'M');
CREATE TYPE "CaseType" AS ENUM ('NUEVO', 'CONTROL');
CREATE TYPE "AttentionStatus" AS ENUM ('ACTIVO', 'ANULADO');
CREATE TYPE "PeriodType" AS ENUM ('MENSUAL', 'SEMANAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL');
CREATE TYPE "PeriodStatus" AS ENUM ('ABIERTO', 'CERRADO', 'BLOQUEADO');

CREATE TABLE "clasificaciones_its" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "programa_id" uuid NOT NULL,
  "codigo" varchar(30) NOT NULL, "nombre" varchar(120) NOT NULL, "orden" integer NOT NULL,
  "activo" boolean NOT NULL DEFAULT true, "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clasificaciones_its_programa_id_fkey" FOREIGN KEY ("programa_id") REFERENCES "programas_salud"("id") ON DELETE RESTRICT,
  CONSTRAINT "uq_clasificaciones_programa_codigo" UNIQUE ("programa_id", "codigo")
);

CREATE TABLE "enfermedades_its" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "clasificacion_id" uuid NOT NULL,
  "codigo" varchar(30), "nombre" varchar(160) NOT NULL, "aplica_hombre" boolean NOT NULL DEFAULT true,
  "aplica_mujer" boolean NOT NULL DEFAULT true, "requiere_alerta_edad" boolean NOT NULL DEFAULT false,
  "orden_formato" integer NOT NULL, "activo" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "enfermedades_its_clasificacion_id_fkey" FOREIGN KEY ("clasificacion_id") REFERENCES "clasificaciones_its"("id") ON DELETE RESTRICT,
  CONSTRAINT "uq_enfermedades_clasificacion_nombre" UNIQUE ("clasificacion_id", "nombre")
);

CREATE TABLE "grupos_edad" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "codigo" varchar(30) NOT NULL UNIQUE,
  "nombre" varchar(120) NOT NULL, "edad_min" integer, "edad_max" integer,
  "orden_formato" integer NOT NULL, "activo" boolean NOT NULL DEFAULT true,
  CONSTRAINT "ck_grupos_edad_rango" CHECK ("edad_min" IS NULL OR "edad_max" IS NULL OR "edad_max" >= "edad_min")
);

CREATE TABLE "grupos_edad_comparativo" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "codigo" varchar(30) NOT NULL UNIQUE,
  "nombre" varchar(120) NOT NULL, "edad_min" integer, "edad_max" integer,
  "definicion" varchar(500) NOT NULL, "activo" boolean NOT NULL DEFAULT true,
  CONSTRAINT "ck_grupos_edad_comparativo_rango" CHECK ("edad_min" IS NULL OR "edad_max" IS NULL OR "edad_max" >= "edad_min")
);

CREATE TABLE "tipos_poblacion" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "codigo" varchar(30) NOT NULL UNIQUE,
  "nombre" varchar(120) NOT NULL, "activo" boolean NOT NULL DEFAULT true
);

CREATE TABLE "semanas_epidemiologicas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "anio" integer NOT NULL,
  "numero_semana" integer NOT NULL, "fecha_inicio" date NOT NULL, "fecha_fin" date NOT NULL,
  "activa" boolean NOT NULL DEFAULT true,
  CONSTRAINT "uq_semanas_anio_numero" UNIQUE ("anio", "numero_semana"),
  CONSTRAINT "ck_semanas_numero" CHECK ("numero_semana" BETWEEN 1 AND 53),
  CONSTRAINT "ck_semanas_fechas" CHECK ("fecha_fin" >= "fecha_inicio")
);

CREATE TABLE "periodos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "tipo" "PeriodType" NOT NULL,
  "anio" integer NOT NULL, "mes" integer, "trimestre" integer, "semestre" integer,
  "semana_epidemiologica_id" uuid, "fecha_inicio" date NOT NULL, "fecha_fin" date NOT NULL,
  "estado" "PeriodStatus" NOT NULL DEFAULT 'ABIERTO',
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "periodos_semana_epidemiologica_id_fkey" FOREIGN KEY ("semana_epidemiologica_id") REFERENCES "semanas_epidemiologicas"("id") ON DELETE RESTRICT,
  CONSTRAINT "ck_periodos_mes" CHECK ("mes" IS NULL OR "mes" BETWEEN 1 AND 12),
  CONSTRAINT "ck_periodos_trimestre" CHECK ("trimestre" IS NULL OR "trimestre" BETWEEN 1 AND 4),
  CONSTRAINT "ck_periodos_semestre" CHECK ("semestre" IS NULL OR "semestre" BETWEEN 1 AND 2),
  CONSTRAINT "ck_periodos_fechas" CHECK ("fecha_fin" >= "fecha_inicio")
);

CREATE TABLE "atenciones_its" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "programa_id" uuid NOT NULL,
  "fecha_atencion" date NOT NULL, "semana_epidemiologica_id" uuid NOT NULL, "periodo_mensual_id" uuid NOT NULL,
  "anio" integer NOT NULL, "mes" integer NOT NULL, "region_id" uuid NOT NULL, "municipio_id" uuid NOT NULL,
  "establecimiento_atencion_id" uuid NOT NULL, "usuario_registro_id" uuid NOT NULL,
  "numero_expediente" varchar(100) NOT NULL, "procedencia_texto" varchar(500) NOT NULL,
  "sexo" "BiologicalSex" NOT NULL, "edad" integer NOT NULL, "grupo_edad_id" uuid NOT NULL,
  "grupo_edad_comparativo_id" uuid NOT NULL, "tipo_poblacion_id" uuid NOT NULL,
  "es_contacto" boolean NOT NULL, "esta_embarazada" boolean NOT NULL,
  "estado" "AttentionStatus" NOT NULL DEFAULT 'ACTIVO', "posible_duplicado" boolean NOT NULL DEFAULT false,
  "observacion" varchar(1000), "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "atenciones_programa_fkey" FOREIGN KEY ("programa_id") REFERENCES "programas_salud"("id") ON DELETE RESTRICT,
  CONSTRAINT "atenciones_semana_fkey" FOREIGN KEY ("semana_epidemiologica_id") REFERENCES "semanas_epidemiologicas"("id") ON DELETE RESTRICT,
  CONSTRAINT "atenciones_periodo_fkey" FOREIGN KEY ("periodo_mensual_id") REFERENCES "periodos"("id") ON DELETE RESTRICT,
  CONSTRAINT "atenciones_region_fkey" FOREIGN KEY ("region_id") REFERENCES "regiones"("id") ON DELETE RESTRICT,
  CONSTRAINT "atenciones_municipio_fkey" FOREIGN KEY ("municipio_id") REFERENCES "municipios"("id") ON DELETE RESTRICT,
  CONSTRAINT "atenciones_establecimiento_fkey" FOREIGN KEY ("establecimiento_atencion_id") REFERENCES "establecimientos_salud"("id") ON DELETE RESTRICT,
  CONSTRAINT "atenciones_usuario_fkey" FOREIGN KEY ("usuario_registro_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT,
  CONSTRAINT "atenciones_grupo_edad_fkey" FOREIGN KEY ("grupo_edad_id") REFERENCES "grupos_edad"("id") ON DELETE RESTRICT,
  CONSTRAINT "atenciones_grupo_comparativo_fkey" FOREIGN KEY ("grupo_edad_comparativo_id") REFERENCES "grupos_edad_comparativo"("id") ON DELETE RESTRICT,
  CONSTRAINT "atenciones_tipo_poblacion_fkey" FOREIGN KEY ("tipo_poblacion_id") REFERENCES "tipos_poblacion"("id") ON DELETE RESTRICT,
  CONSTRAINT "ck_atenciones_edad" CHECK ("edad" BETWEEN 0 AND 120),
  CONSTRAINT "ck_atenciones_mes" CHECK ("mes" BETWEEN 1 AND 12),
  CONSTRAINT "ck_atenciones_embarazo" CHECK ("sexo" = 'M' OR "esta_embarazada" = false)
);

CREATE TABLE "diagnosticos_atencion" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "atencion_id" uuid NOT NULL,
  "enfermedad_id" uuid NOT NULL, "tipo_caso" "CaseType" NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "diagnosticos_atencion_fkey" FOREIGN KEY ("atencion_id") REFERENCES "atenciones_its"("id") ON DELETE CASCADE,
  CONSTRAINT "diagnosticos_enfermedad_fkey" FOREIGN KEY ("enfermedad_id") REFERENCES "enfermedades_its"("id") ON DELETE RESTRICT,
  CONSTRAINT "uq_diagnosticos_atencion_enfermedad_tipo" UNIQUE ("atencion_id", "enfermedad_id", "tipo_caso")
);

CREATE INDEX "idx_clasificaciones_programa_orden" ON "clasificaciones_its"("programa_id", "activo", "orden");
CREATE INDEX "idx_enfermedades_clasificacion_orden" ON "enfermedades_its"("clasificacion_id", "activo", "orden_formato");
CREATE INDEX "idx_grupos_edad_rango" ON "grupos_edad"("activo", "edad_min", "edad_max");
CREATE INDEX "idx_grupos_edad_comparativo_rango" ON "grupos_edad_comparativo"("activo", "edad_min", "edad_max");
CREATE INDEX "idx_semanas_fechas" ON "semanas_epidemiologicas"("fecha_inicio", "fecha_fin", "activa");
CREATE INDEX "idx_periodos_tipo_fecha_estado" ON "periodos"("tipo", "anio", "mes", "estado");
CREATE INDEX "idx_periodos_fechas" ON "periodos"("fecha_inicio", "fecha_fin");
CREATE INDEX "idx_atenciones_establecimiento_fecha" ON "atenciones_its"("establecimiento_atencion_id", "fecha_atencion", "estado");
CREATE INDEX "idx_atenciones_posible_duplicado" ON "atenciones_its"("numero_expediente", "fecha_atencion", "establecimiento_atencion_id");
CREATE INDEX "idx_atenciones_territorio_periodo" ON "atenciones_its"("region_id", "municipio_id", "anio", "mes");
CREATE INDEX "idx_diagnosticos_enfermedad_tipo" ON "diagnosticos_atencion"("enfermedad_id", "tipo_caso");

INSERT INTO "permisos" ("codigo", "modulo", "accion", "descripcion") VALUES
  ('its1:attentions:create', 'its1', 'create', 'Registrar atenciones ITS 1 dentro del establecimiento autorizado.'),
  ('its1:attentions:read', 'its1', 'read', 'Consultar atenciones ITS 1 del establecimiento autorizado.');

INSERT INTO "rol_permiso" ("rol_id", "permiso_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permisos" p
WHERE r."codigo" IN ('DIGITADOR_COORDINACION', 'RESPONSABLE_ESTABLECIMIENTO')
  AND p."codigo" IN ('its1:attentions:create', 'its1:attentions:read');

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['clasificaciones_its','enfermedades_its','grupos_edad','grupos_edad_comparativo','tipos_poblacion','semanas_epidemiologicas','periodos','atenciones_its','diagnosticos_atencion']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon', table_name);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM authenticated', table_name);
  END LOOP;
END $$;
