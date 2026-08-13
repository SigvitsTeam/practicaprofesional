CREATE TYPE "TerritorialScopeType" AS ENUM (
  'NACIONAL', 'REGION', 'MUNICIPIO', 'ESTABLECIMIENTO'
);

CREATE TABLE "usuarios" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nombre_completo" varchar(160) NOT NULL,
  "email" varchar(255) NOT NULL UNIQUE,
  "telefono" varchar(30),
  "activo" boolean NOT NULL DEFAULT true,
  "ultimo_acceso_at" timestamptz(3),
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "identidades_externas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "usuario_id" uuid NOT NULL REFERENCES "usuarios"("id") ON DELETE CASCADE,
  "emisor" varchar(255) NOT NULL,
  "sujeto" varchar(255) NOT NULL,
  "email_referencia" varchar(255),
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "uq_identidad_emisor_sujeto" UNIQUE ("emisor", "sujeto")
);

CREATE TABLE "roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "codigo" varchar(60) NOT NULL UNIQUE,
  "nombre" varchar(120) NOT NULL,
  "descripcion" varchar(500),
  "nivel_jerarquico" integer NOT NULL,
  "activo" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "permisos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "codigo" varchar(100) NOT NULL UNIQUE,
  "modulo" varchar(60) NOT NULL,
  "accion" varchar(60) NOT NULL,
  "descripcion" varchar(500),
  "activo" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "rol_permiso" (
  "rol_id" uuid NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "permiso_id" uuid NOT NULL REFERENCES "permisos"("id") ON DELETE CASCADE,
  PRIMARY KEY ("rol_id", "permiso_id")
);

CREATE TABLE "usuario_roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "usuario_id" uuid NOT NULL REFERENCES "usuarios"("id") ON DELETE CASCADE,
  "rol_id" uuid NOT NULL REFERENCES "roles"("id") ON DELETE RESTRICT,
  "fecha_inicio" date NOT NULL,
  "fecha_fin" date,
  "activo" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ck_usuario_roles_vigencia" CHECK ("fecha_fin" IS NULL OR "fecha_fin" >= "fecha_inicio")
);

CREATE TABLE "usuario_asignaciones" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "usuario_id" uuid NOT NULL REFERENCES "usuarios"("id") ON DELETE CASCADE,
  "tipo_alcance" "TerritorialScopeType" NOT NULL,
  "region_id" uuid REFERENCES "regiones"("id") ON DELETE RESTRICT,
  "municipio_id" uuid REFERENCES "municipios"("id") ON DELETE RESTRICT,
  "establecimiento_id" uuid REFERENCES "establecimientos_salud"("id") ON DELETE RESTRICT,
  "fecha_inicio" date NOT NULL,
  "fecha_fin" date,
  "activo" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ck_usuario_asignaciones_vigencia" CHECK ("fecha_fin" IS NULL OR "fecha_fin" >= "fecha_inicio"),
  CONSTRAINT "ck_usuario_asignaciones_objetivo" CHECK (
    ("tipo_alcance" = 'NACIONAL' AND "region_id" IS NULL AND "municipio_id" IS NULL AND "establecimiento_id" IS NULL) OR
    ("tipo_alcance" = 'REGION' AND "region_id" IS NOT NULL AND "municipio_id" IS NULL AND "establecimiento_id" IS NULL) OR
    ("tipo_alcance" = 'MUNICIPIO' AND "region_id" IS NULL AND "municipio_id" IS NOT NULL AND "establecimiento_id" IS NULL) OR
    ("tipo_alcance" = 'ESTABLECIMIENTO' AND "region_id" IS NULL AND "municipio_id" IS NULL AND "establecimiento_id" IS NOT NULL)
  )
);

ALTER TABLE "auditoria_eventos"
  ADD CONSTRAINT "auditoria_eventos_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL;

CREATE INDEX "idx_usuarios_activo" ON "usuarios"("activo");
CREATE UNIQUE INDEX "uq_usuarios_email_normalizado" ON "usuarios"(lower("email"));
CREATE INDEX "idx_identidades_usuario" ON "identidades_externas"("usuario_id");
CREATE INDEX "idx_usuario_roles_vigencia" ON "usuario_roles"("usuario_id", "activo", "fecha_inicio", "fecha_fin");
CREATE UNIQUE INDEX "uq_usuario_rol_actual" ON "usuario_roles"("usuario_id", "rol_id")
  WHERE "activo" = true AND "fecha_fin" IS NULL;
CREATE INDEX "idx_usuario_asignaciones_vigencia" ON "usuario_asignaciones"("usuario_id", "activo", "fecha_inicio", "fecha_fin");
CREATE INDEX "idx_usuario_asignaciones_region" ON "usuario_asignaciones"("region_id");
CREATE INDEX "idx_usuario_asignaciones_municipio" ON "usuario_asignaciones"("municipio_id");
CREATE INDEX "idx_usuario_asignaciones_establecimiento" ON "usuario_asignaciones"("establecimiento_id");

INSERT INTO "roles" ("codigo", "nombre", "nivel_jerarquico") VALUES
  ('SUPERADMIN', 'SuperAdmin', 100),
  ('ADMIN_CENTRAL', 'Admin Central', 90),
  ('SUPERADMIN_REGIONAL', 'SuperAdmin Regional', 80),
  ('ADMIN_REGIONAL', 'Admin Regional', 70),
  ('COORDINADOR_MUNICIPAL', 'Coordinador Municipal', 60),
  ('DIGITADOR_COORDINACION', 'Digitador de Coordinación', 50),
  ('RESPONSABLE_ESTABLECIMIENTO', 'Responsable de Establecimiento', 40),
  ('SUPERVISOR_CONSULTA', 'Supervisor o Consulta', 30);

INSERT INTO "permisos" ("codigo", "modulo", "accion", "descripcion") VALUES
  ('territorial:regions:read', 'territorial', 'read', 'Consultar regiones dentro del alcance asignado.'),
  ('territorial:regions:create', 'territorial', 'create', 'Crear regiones sanitarias.');

INSERT INTO "rol_permiso" ("rol_id", "permiso_id")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permisos" p
WHERE p."codigo" = 'territorial:regions:read';

INSERT INTO "rol_permiso" ("rol_id", "permiso_id")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permisos" p
WHERE r."codigo" = 'SUPERADMIN' AND p."codigo" = 'territorial:regions:create';
