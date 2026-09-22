CREATE INDEX "idx_atenciones_municipio_fecha_estado"
ON "atenciones_its"("municipio_id", "fecha_atencion", "estado");

CREATE INDEX "idx_atenciones_municipio_semana_estado"
ON "atenciones_its"("municipio_id", "semana_epidemiologica_id", "estado");
