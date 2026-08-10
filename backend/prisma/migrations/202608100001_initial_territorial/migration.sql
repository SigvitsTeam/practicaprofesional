CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE "RegionType" AS ENUM ('SANITARIA', 'DEPARTAMENTAL', 'METROPOLITANA');
CREATE TYPE "OperationalStatus" AS ENUM (
  'PRECONFIGURADO', 'CREADO', 'EN_PILOTAJE', 'ACTIVO', 'INACTIVO', 'SUSPENDIDO'
);

CREATE TABLE "programas_salud" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "codigo" varchar(30) NOT NULL UNIQUE,
  "nombre" varchar(120) NOT NULL,
  "descripcion" varchar(500),
  "activo" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "regiones" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "codigo" varchar(30) NOT NULL UNIQUE,
  "nombre" varchar(120) NOT NULL,
  "numero_region" varchar(30),
  "tipo" "RegionType" NOT NULL,
  "estado_operativo" "OperationalStatus" NOT NULL DEFAULT 'CREADO',
  "activo" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "redes_salud" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "region_id" uuid NOT NULL REFERENCES "regiones"("id") ON DELETE RESTRICT,
  "codigo" varchar(30) NOT NULL,
  "nombre" varchar(120) NOT NULL,
  "descripcion" varchar(500),
  "estado_operativo" "OperationalStatus" NOT NULL DEFAULT 'CREADO',
  "fecha_inicio" date NOT NULL,
  "fecha_fin" date,
  "activo" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "uq_redes_region_codigo" UNIQUE ("region_id", "codigo"),
  CONSTRAINT "ck_redes_vigencia" CHECK ("fecha_fin" IS NULL OR "fecha_fin" >= "fecha_inicio")
);

CREATE TABLE "municipios" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "region_id" uuid NOT NULL REFERENCES "regiones"("id") ON DELETE RESTRICT,
  "codigo_oficial" varchar(30) NOT NULL UNIQUE,
  "nombre" varchar(120) NOT NULL,
  "estado_operativo" "OperationalStatus" NOT NULL DEFAULT 'CREADO',
  "mapa_validado" boolean NOT NULL DEFAULT false,
  "activo" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "red_municipios" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "red_id" uuid NOT NULL REFERENCES "redes_salud"("id") ON DELETE RESTRICT,
  "municipio_id" uuid NOT NULL REFERENCES "municipios"("id") ON DELETE RESTRICT,
  "programa_id" uuid REFERENCES "programas_salud"("id") ON DELETE RESTRICT,
  "fecha_inicio" date NOT NULL,
  "fecha_fin" date,
  "activo" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ck_red_municipios_vigencia" CHECK ("fecha_fin" IS NULL OR "fecha_fin" >= "fecha_inicio")
);

CREATE TABLE "establecimientos_salud" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "municipio_id" uuid NOT NULL REFERENCES "municipios"("id") ON DELETE RESTRICT,
  "codigo" varchar(30) NOT NULL UNIQUE,
  "nombre" varchar(160) NOT NULL,
  "tipo" varchar(50) NOT NULL,
  "direccion" varchar(300),
  "latitud" decimal(9, 6),
  "longitud" decimal(9, 6),
  "geom" geometry(Point, 4326),
  "estado_operativo" "OperationalStatus" NOT NULL DEFAULT 'CREADO',
  "coordenadas_validadas" boolean NOT NULL DEFAULT false,
  "activo" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ck_establecimientos_latitud" CHECK ("latitud" IS NULL OR "latitud" BETWEEN -90 AND 90),
  CONSTRAINT "ck_establecimientos_longitud" CHECK ("longitud" IS NULL OR "longitud" BETWEEN -180 AND 180),
  CONSTRAINT "ck_establecimientos_coordenadas" CHECK (("latitud" IS NULL) = ("longitud" IS NULL))
);

CREATE TABLE "auditoria_eventos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "usuario_id" uuid,
  "accion" varchar(100) NOT NULL,
  "entidad" varchar(100) NOT NULL,
  "entidad_id" uuid,
  "nivel_dato" varchar(30) NOT NULL,
  "datos_anteriores" jsonb,
  "datos_nuevos" jsonb,
  "motivo" varchar(500),
  "request_id" varchar(128),
  "ip" inet,
  "user_agent" varchar(500),
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_regiones_estado" ON "regiones"("activo", "estado_operativo");
CREATE INDEX "idx_redes_region_activo" ON "redes_salud"("region_id", "activo");
CREATE INDEX "idx_municipios_region_activo" ON "municipios"("region_id", "activo");
CREATE INDEX "idx_red_municipios_red_vigencia" ON "red_municipios"("red_id", "fecha_inicio", "fecha_fin");
CREATE INDEX "idx_red_municipios_municipio_vigencia" ON "red_municipios"("municipio_id", "fecha_inicio", "fecha_fin");
CREATE UNIQUE INDEX "uq_red_municipio_programa_actual"
  ON "red_municipios"("municipio_id", COALESCE("programa_id", '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE "activo" = true AND "fecha_fin" IS NULL;
CREATE INDEX "idx_establecimientos_municipio_activo" ON "establecimientos_salud"("municipio_id", "activo");
CREATE INDEX "idx_auditoria_entidad_fecha" ON "auditoria_eventos"("entidad", "entidad_id", "created_at");
CREATE INDEX "idx_auditoria_usuario_fecha" ON "auditoria_eventos"("usuario_id", "created_at");
CREATE INDEX "gist_establecimientos_geom" ON "establecimientos_salud" USING GIST ("geom");

CREATE OR REPLACE FUNCTION validate_network_municipality_region()
RETURNS trigger AS $$
BEGIN
  IF (SELECT "region_id" FROM "redes_salud" WHERE "id" = NEW."red_id") IS DISTINCT FROM
     (SELECT "region_id" FROM "municipios" WHERE "id" = NEW."municipio_id") THEN
    RAISE EXCEPTION 'La red y el municipio deben pertenecer a la misma región'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_red_municipio_misma_region"
BEFORE INSERT OR UPDATE OF "red_id", "municipio_id" ON "red_municipios"
FOR EACH ROW EXECUTE FUNCTION validate_network_municipality_region();

CREATE OR REPLACE FUNCTION sync_health_facility_geom()
RETURNS trigger AS $$
BEGIN
  NEW."geom" := CASE
    WHEN NEW."latitud" IS NULL THEN NULL
    ELSE ST_SetSRID(ST_MakePoint(NEW."longitud"::double precision, NEW."latitud"::double precision), 4326)
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_establecimiento_geom"
BEFORE INSERT OR UPDATE OF "latitud", "longitud" ON "establecimientos_salud"
FOR EACH ROW EXECUTE FUNCTION sync_health_facility_geom();
