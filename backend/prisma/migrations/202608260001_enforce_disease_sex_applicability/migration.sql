ALTER TABLE "enfermedades_its"
ADD CONSTRAINT "ck_enfermedades_aplica_algun_sexo"
CHECK ("aplica_hombre" OR "aplica_mujer");

CREATE OR REPLACE FUNCTION "validar_diagnostico_aplicabilidad_sexo"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  sexo_atencion "BiologicalSex";
  aplica_hombre boolean;
  aplica_mujer boolean;
BEGIN
  SELECT a."sexo", e."aplica_hombre", e."aplica_mujer"
  INTO sexo_atencion, aplica_hombre, aplica_mujer
  FROM "atenciones_its" a
  CROSS JOIN "enfermedades_its" e
  WHERE a."id" = NEW."atencion_id"
    AND e."id" = NEW."enfermedad_id";

  IF FOUND AND (
    (sexo_atencion = 'H' AND NOT aplica_hombre)
    OR (sexo_atencion = 'M' AND NOT aplica_mujer)
  ) THEN
    RAISE EXCEPTION 'La enfermedad no aplica al sexo de la atención.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_diagnostico_aplicabilidad_sexo"
BEFORE INSERT OR UPDATE OF "atencion_id", "enfermedad_id"
ON "diagnosticos_atencion"
FOR EACH ROW
EXECUTE FUNCTION "validar_diagnostico_aplicabilidad_sexo"();

CREATE OR REPLACE FUNCTION "validar_cambio_sexo_atencion"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."sexo" IS DISTINCT FROM OLD."sexo" AND EXISTS (
    SELECT 1
    FROM "diagnosticos_atencion" d
    JOIN "enfermedades_its" e ON e."id" = d."enfermedad_id"
    WHERE d."atencion_id" = NEW."id"
      AND (
        (NEW."sexo" = 'H' AND NOT e."aplica_hombre")
        OR (NEW."sexo" = 'M' AND NOT e."aplica_mujer")
      )
  ) THEN
    RAISE EXCEPTION 'El nuevo sexo no es compatible con los diagnósticos existentes.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_atencion_cambio_sexo"
BEFORE UPDATE OF "sexo"
ON "atenciones_its"
FOR EACH ROW
EXECUTE FUNCTION "validar_cambio_sexo_atencion"();

CREATE OR REPLACE FUNCTION "validar_cambio_aplicabilidad_enfermedad"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "diagnosticos_atencion" d
    JOIN "atenciones_its" a ON a."id" = d."atencion_id"
    WHERE d."enfermedad_id" = NEW."id"
      AND (
        (a."sexo" = 'H' AND NOT NEW."aplica_hombre")
        OR (a."sexo" = 'M' AND NOT NEW."aplica_mujer")
      )
  ) THEN
    RAISE EXCEPTION 'La aplicabilidad dejaría diagnósticos existentes incompatibles.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_enfermedad_cambio_aplicabilidad"
BEFORE UPDATE OF "aplica_hombre", "aplica_mujer"
ON "enfermedades_its"
FOR EACH ROW
EXECUTE FUNCTION "validar_cambio_aplicabilidad_enfermedad"();
