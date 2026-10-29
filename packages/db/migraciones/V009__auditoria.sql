-- =============================================================================
-- V009 · Auditoría: bitácora inmutable y triggers comunes
-- =============================================================================
CREATE TYPE auditoria.operacion AS ENUM ('INSERT', 'UPDATE', 'DELETE');

CREATE TABLE auditoria.evento (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  esquema          text NOT NULL,
  tabla            text NOT NULL,
  registro_id      text, -- id del registro; nulo en tablas con clave compuesta (ver datos)
  operacion        auditoria.operacion NOT NULL,
  actor_usuario_id uuid, -- sin FK: la bitácora debe sobrevivir a los datos que describe
  datos_antes      jsonb,
  datos_despues    jsonb,
  ocurrido_en      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON auditoria.evento (esquema, tabla, registro_id);
CREATE INDEX ON auditoria.evento (actor_usuario_id);
CREATE INDEX evento_por_fecha ON auditoria.evento USING brin (ocurrido_en); -- tabla de solo inserción

CREATE TRIGGER evento_inmutable
  BEFORE UPDATE OR DELETE ON auditoria.evento
  FOR EACH ROW EXECUTE FUNCTION auditoria.fn_solo_insercion();
CREATE TRIGGER evento_no_truncable
  BEFORE TRUNCATE ON auditoria.evento
  FOR EACH STATEMENT EXECUTE FUNCTION auditoria.fn_solo_insercion();

-- Registra cada cambio. La API identifica al actor con: SET LOCAL app.usuario_id = '<uuid>'
-- N6: las columnas sensibles se enmascaran (se sabe que cambiaron, no su valor).
CREATE FUNCTION auditoria.fn_auditar() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  sensibles text[] := ARRAY['password_hash', 'token_qr', 'token_push'];
  col     text;
  antes   jsonb;
  despues jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN antes := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN despues := to_jsonb(NEW); END IF;
  FOREACH col IN ARRAY sensibles LOOP
    IF antes ? col AND antes ->> col IS NOT NULL THEN
      antes := jsonb_set(antes, ARRAY[col], '"[oculto]"');
    END IF;
    IF despues ? col AND despues ->> col IS NOT NULL THEN
      despues := jsonb_set(despues, ARRAY[col], '"[oculto]"');
    END IF;
  END LOOP;

  INSERT INTO auditoria.evento (esquema, tabla, registro_id, operacion, actor_usuario_id, datos_antes, datos_despues)
  VALUES (TG_TABLE_SCHEMA, TG_TABLE_NAME,
          coalesce(despues ->> 'id', antes ->> 'id'),
          TG_OP::auditoria.operacion,
          nullif(current_setting('app.usuario_id', true), '')::uuid,
          antes, despues);
  RETURN NULL;
END $$;

-- Asocia los triggers comunes a todas las tablas de negocio
DO $$
DECLARE
  t record;
  -- Tablas operacionales de alto volumen que no aportan a la trazabilidad
  excluidas text[] := ARRAY['comunicacion.notificacion', 'comunicacion.envio',
                            'comunicacion.dispositivo', 'reservas.importacion_error'];
BEGIN
  FOR t IN
    SELECT table_schema, table_name
      FROM information_schema.tables
     WHERE table_type = 'BASE TABLE'
       AND table_schema IN ('seguridad', 'institucion', 'academico', 'reservas', 'mantencion', 'comunicacion')
  LOOP
    IF NOT (t.table_schema || '.' || t.table_name) = ANY (excluidas) THEN
      EXECUTE format('CREATE TRIGGER auditar AFTER INSERT OR UPDATE OR DELETE ON %I.%I
                      FOR EACH ROW EXECUTE FUNCTION auditoria.fn_auditar()', t.table_schema, t.table_name);
    END IF;
  END LOOP;

  FOR t IN
    SELECT table_schema, table_name
      FROM information_schema.columns
     WHERE column_name = 'actualizado_en'
       AND table_schema IN ('seguridad', 'institucion', 'academico', 'reservas', 'mantencion', 'comunicacion')
  LOOP
    EXECUTE format('CREATE TRIGGER marcar_actualizado BEFORE UPDATE ON %I.%I
                    FOR EACH ROW EXECUTE FUNCTION auditoria.fn_marcar_actualizado()', t.table_schema, t.table_name);
  END LOOP;
END $$;
