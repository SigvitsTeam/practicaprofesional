-- Puerto Cortés (0506) is published as a municipal module by Honduras' SINIT.
-- Its polygon is independently available in the RMGIR WGS84 municipal layer.
-- Evidence and source URLs: docs/fuentes-geograficas-piloto.md.
UPDATE "municipios"
SET
  "mapa_validado" = true,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "codigo_oficial" = '0506'
  AND "mapa_validado" = false;
