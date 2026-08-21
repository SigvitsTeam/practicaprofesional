CREATE TYPE "ExportJobStatus" AS ENUM ('PENDIENTE', 'PROCESANDO', 'COMPLETADO', 'FALLIDO');
CREATE TYPE "ExportFormat" AS ENUM ('XLSX', 'PDF');
CREATE TYPE "ExportScopeLevel" AS ENUM ('NACIONAL', 'REGION', 'MUNICIPIO', 'ESTABLECIMIENTO');

CREATE TABLE "trabajos_exportacion" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "solicitado_por_usuario_id" UUID NOT NULL,
  "idempotency_key" UUID NOT NULL,
  "tipo_reporte" VARCHAR(80) NOT NULL,
  "formato" "ExportFormat" NOT NULL,
  "nivel_alcance" "ExportScopeLevel" NOT NULL,
  "territorio_id" UUID,
  "anio" INTEGER NOT NULL,
  "mes" INTEGER NOT NULL,
  "estado" "ExportJobStatus" NOT NULL DEFAULT 'PENDIENTE',
  "intentos" INTEGER NOT NULL DEFAULT 0,
  "max_intentos" INTEGER NOT NULL DEFAULT 3,
  "storage_key_salida" VARCHAR(500),
  "salida_expira_at" TIMESTAMPTZ(3),
  "codigo_error" VARCHAR(80),
  "iniciado_at" TIMESTAMPTZ(3),
  "finalizado_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "trabajos_exportacion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "trabajos_exportacion_usuario_fkey" FOREIGN KEY ("solicitado_por_usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ck_exportaciones_periodo" CHECK ("anio" BETWEEN 2000 AND 2100 AND "mes" BETWEEN 1 AND 12),
  CONSTRAINT "ck_exportaciones_alcance" CHECK (("nivel_alcance" = 'NACIONAL' AND "territorio_id" IS NULL) OR ("nivel_alcance" <> 'NACIONAL' AND "territorio_id" IS NOT NULL)),
  CONSTRAINT "ck_exportaciones_intentos" CHECK ("intentos" >= 0 AND "max_intentos" BETWEEN 1 AND 10)
);

CREATE UNIQUE INDEX "uq_exportacion_usuario_idempotencia" ON "trabajos_exportacion"("solicitado_por_usuario_id", "idempotency_key");
CREATE INDEX "idx_exportaciones_estado_fecha" ON "trabajos_exportacion"("estado", "created_at");
CREATE INDEX "idx_exportaciones_usuario_fecha" ON "trabajos_exportacion"("solicitado_por_usuario_id", "created_at");

ALTER TABLE "trabajos_exportacion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "trabajos_exportacion" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "trabajos_exportacion" FROM anon, authenticated;

INSERT INTO "permisos" ("codigo", "modulo", "accion", "descripcion") VALUES
  ('exports:jobs:read', 'exports', 'read_jobs', 'Consultar trabajos de exportación propios.'),
  ('exports:jobs:create', 'exports', 'create_jobs', 'Solicitar exportaciones agregadas dentro del alcance autorizado.');

INSERT INTO "rol_permiso" ("rol_id", "permiso_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permisos" p
WHERE r."codigo" IN ('SUPERADMIN', 'ADMIN_CENTRAL', 'SUPERADMIN_REGIONAL', 'ADMIN_REGIONAL', 'COORDINADOR_MUNICIPAL', 'RESPONSABLE_ESTABLECIMIENTO', 'SUPERVISOR_CONSULTA')
  AND p."codigo" IN ('exports:jobs:read', 'exports:jobs:create');
