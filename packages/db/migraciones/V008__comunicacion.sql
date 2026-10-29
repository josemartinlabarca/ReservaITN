-- =============================================================================
-- V008 · Esquema comunicacion
-- =============================================================================
CREATE TYPE comunicacion.canal        AS ENUM ('APP', 'CORREO', 'PUSH');
CREATE TYPE comunicacion.plataforma   AS ENUM ('ANDROID', 'IOS');
CREATE TYPE comunicacion.estado_envio AS ENUM ('PENDIENTE', 'ENVIADO', 'FALLIDO');

CREATE TABLE comunicacion.evento_notificacion (
  codigo      text PRIMARY KEY CHECK (codigo ~ '^[A-Z_]+$'),
  descripcion text NOT NULL,
  obligatorio boolean NOT NULL DEFAULT false -- no se puede desactivar en las preferencias
);

CREATE TABLE comunicacion.plantilla (
  evento_codigo  text NOT NULL REFERENCES comunicacion.evento_notificacion (codigo),
  canal          comunicacion.canal NOT NULL,
  asunto         text,
  cuerpo         text NOT NULL,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (evento_codigo, canal),
  CHECK (canal <> 'CORREO' OR asunto IS NOT NULL)
);

CREATE TABLE comunicacion.preferencia (
  usuario_id    uuid NOT NULL REFERENCES seguridad.usuario (id) ON DELETE CASCADE,
  evento_codigo text NOT NULL REFERENCES comunicacion.evento_notificacion (codigo),
  canal         comunicacion.canal NOT NULL,
  activo        boolean NOT NULL, -- solo se guardan excepciones; por defecto todo está activo
  PRIMARY KEY (usuario_id, evento_codigo, canal)
);

CREATE FUNCTION comunicacion.fn_validar_preferencia() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT NEW.activo AND (SELECT obligatorio FROM comunicacion.evento_notificacion
                          WHERE codigo = NEW.evento_codigo) THEN
    RAISE EXCEPTION 'El aviso % es obligatorio y no se puede desactivar', NEW.evento_codigo
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER preferencia_respeta_obligatorios
  BEFORE INSERT OR UPDATE ON comunicacion.preferencia
  FOR EACH ROW EXECUTE FUNCTION comunicacion.fn_validar_preferencia();

CREATE TABLE comunicacion.dispositivo (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES seguridad.usuario (id) ON DELETE CASCADE,
  token_push text NOT NULL UNIQUE,
  plataforma comunicacion.plataforma NOT NULL,
  ultimo_uso timestamptz NOT NULL DEFAULT now(),
  creado_en  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON comunicacion.dispositivo (usuario_id);

CREATE TABLE comunicacion.notificacion (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id       uuid NOT NULL REFERENCES seguridad.usuario (id) ON DELETE CASCADE,
  evento_codigo    text NOT NULL REFERENCES comunicacion.evento_notificacion (codigo),
  titulo           text NOT NULL, -- texto ya renderizado: no cambia si se edita la plantilla
  cuerpo           text NOT NULL,
  solicitud_id     uuid REFERENCES reservas.solicitud (id),
  reserva_id       uuid REFERENCES reservas.reserva (id),
  orden_trabajo_id uuid REFERENCES mantencion.orden_trabajo (id),
  leida_en         timestamptz,
  creado_en        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notificacion_una_referencia CHECK (num_nonnulls(solicitud_id, reserva_id, orden_trabajo_id) <= 1)
);
CREATE INDEX ON comunicacion.notificacion (usuario_id, creado_en DESC);
CREATE INDEX notificacion_no_leidas ON comunicacion.notificacion (usuario_id) WHERE leida_en IS NULL;

-- Cola de salida (outbox): se escribe en la misma transacción que la acción de negocio
CREATE TABLE comunicacion.envio (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notificacion_id uuid NOT NULL REFERENCES comunicacion.notificacion (id) ON DELETE CASCADE,
  canal           comunicacion.canal NOT NULL CHECK (canal <> 'APP'), -- la app lee la bandeja directamente
  estado          comunicacion.estado_envio NOT NULL DEFAULT 'PENDIENTE',
  intentos        smallint NOT NULL DEFAULT 0 CHECK (intentos BETWEEN 0 AND 20),
  ultimo_error    text,
  enviado_en      timestamptz,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notificacion_id, canal),
  CONSTRAINT envio_enviado_con_fecha CHECK ((estado = 'ENVIADO') = (enviado_en IS NOT NULL))
);
CREATE INDEX envio_pendientes ON comunicacion.envio (creado_en) WHERE estado = 'PENDIENTE';
