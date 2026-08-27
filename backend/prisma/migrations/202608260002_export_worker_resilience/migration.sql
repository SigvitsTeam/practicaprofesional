-- Supports bounded artifact expiration scans and stale-job recovery without full table scans.
-- Prisma runs PostgreSQL migrations without an implicit transaction. CONCURRENTLY
-- keeps the export table writable while these indexes are built in production.
SET lock_timeout = '5s';
SET statement_timeout = '30min';

CREATE INDEX CONCURRENTLY "idx_exportaciones_expiracion_id"
  ON "trabajos_exportacion"("salida_expira_at", "id");

CREATE INDEX CONCURRENTLY "idx_exportaciones_estado_inicio_id"
  ON "trabajos_exportacion"("estado", "iniciado_at", "id");
