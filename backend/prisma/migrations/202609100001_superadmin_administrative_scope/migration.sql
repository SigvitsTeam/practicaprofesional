-- Los SuperAdmin administran la plataforma y no consultan datos epidemiológicos
-- ni participan en captura ITS-1, analítica, exportaciones o flujo ITS-2. Los
-- permisos de catálogo, usuarios, redes y auditoría permanecen sin cambios.
DELETE FROM "rol_permiso" rp
USING "roles" r, "permisos" p
WHERE rp."rol_id" = r."id"
  AND rp."permiso_id" = p."id"
  AND r."codigo" IN ('SUPERADMIN', 'SUPERADMIN_REGIONAL')
  AND p."modulo" IN ('analytics', 'exports', 'its1', 'its2');

-- Soporta la suma preliminar desde ITS-1 en cada nivel sin cargar el detalle
-- clínico completo en la aplicación.
CREATE INDEX "idx_atenciones_periodo_estado_region"
  ON "atenciones_its" ("periodo_mensual_id", "estado", "region_id");
CREATE INDEX "idx_atenciones_periodo_estado_municipio"
  ON "atenciones_its" ("periodo_mensual_id", "estado", "municipio_id");
CREATE INDEX "idx_atenciones_periodo_estado_establecimiento"
  ON "atenciones_its" ("periodo_mensual_id", "estado", "establecimiento_atencion_id");
