-- Fail safely on legacy duplicates/invalid months; never delete institutional periods.
CREATE UNIQUE INDEX "uq_periodos_mensuales_anio_mes"
  ON "periodos" ("anio", "mes") WHERE "tipo" = 'MENSUAL';
ALTER TABLE "periodos" ADD CONSTRAINT "ck_periodos_mensuales_completos"
  CHECK ("tipo" <> 'MENSUAL' OR ("mes" IS NOT NULL AND "anio" BETWEEN 2020 AND 2100));
-- Fail closed for future inserts that omit state; existing states are untouched.
ALTER TABLE "periodos" ALTER COLUMN "estado" SET DEFAULT 'BLOQUEADO';

INSERT INTO "permisos" ("codigo", "modulo", "accion", "descripcion")
VALUES ('reporting:periods:manage', 'reporting', 'manage', 'Crear calendarios y abrir períodos mensuales nacionales con auditoría.')
ON CONFLICT ("codigo") DO NOTHING;
INSERT INTO "rol_permiso" ("rol_id", "permiso_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permisos" p
WHERE r."codigo" IN ('SUPERADMIN', 'ADMIN_CENTRAL') AND p."codigo" = 'reporting:periods:manage'
ON CONFLICT DO NOTHING;
