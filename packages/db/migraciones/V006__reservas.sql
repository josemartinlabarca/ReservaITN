-- =============================================================================
-- V006 · Esquema reservas
-- =============================================================================
CREATE TYPE reservas.origen           AS ENUM ('SOLICITUD', 'PLANIFICACION', 'MANTENCION');
CREATE TYPE reservas.estado_reserva   AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA', 'EXPIRADA', 'LIBERADA');
CREATE TYPE reservas.accion_regla     AS ENUM ('AUTO_APROBAR', 'REQUIERE_APROBACION', 'PROHIBIDO');
CREATE TYPE reservas.ambito_aprobador AS ENUM ('CARRERA_SOLICITANTE', 'CARRERA_ESPACIO', 'INSTITUCION');
CREATE TYPE reservas.decision         AS ENUM ('APROBADA', 'RECHAZADA');
CREATE TYPE reservas.metodo_check_in  AS ENUM ('QR', 'MANUAL');

CREATE TABLE reservas.tipo_actividad (
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE CHECK (codigo ~ '^[A-Z_]+$'),
  nombre text NOT NULL,
  activo boolean NOT NULL DEFAULT true
);

CREATE TABLE reservas.importacion (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  archivo_nombre text NOT NULL,
  periodo_id     uuid NOT NULL REFERENCES academico.periodo_academico (id),
  usuario_id     uuid NOT NULL REFERENCES seguridad.usuario (id),
  total_filas    integer NOT NULL CHECK (total_filas >= 0),
  creado_en      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reservas.importacion_error (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  importacion_id uuid NOT NULL REFERENCES reservas.importacion (id) ON DELETE CASCADE,
  fila           integer NOT NULL CHECK (fila >= 1),
  columna        text, -- nulo = error de la fila completa (ej. choque de horario)
  mensaje        text NOT NULL,
  UNIQUE NULLS NOT DISTINCT (importacion_id, fila, columna)
);

CREATE TABLE reservas.solicitud (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitante_usuario_id uuid NOT NULL REFERENCES seguridad.usuario (id),
  tipo_actividad_id      uuid NOT NULL REFERENCES reservas.tipo_actividad (id),
  seccion_id             uuid REFERENCES academico.seccion (id),
  origen                 reservas.origen NOT NULL DEFAULT 'SOLICITUD',
  descripcion            text NOT NULL CHECK (length(trim(descripcion)) >= 3),
  asistentes             integer NOT NULL CHECK (asistentes > 0),
  fecha_desde            date, -- solo solicitudes recurrentes (D13)
  fecha_hasta            date,
  importacion_id         uuid REFERENCES reservas.importacion (id),
  creado_en              timestamptz NOT NULL DEFAULT now(),
  CHECK ((fecha_desde IS NULL) = (fecha_hasta IS NULL)),
  CHECK (fecha_hasta >= fecha_desde),
  CONSTRAINT solicitud_planificacion_importada CHECK ((origen = 'PLANIFICACION') = (importacion_id IS NOT NULL))
);
CREATE INDEX ON reservas.solicitud (solicitante_usuario_id, creado_en DESC);
CREATE INDEX ON reservas.solicitud (seccion_id);
CREATE INDEX ON reservas.solicitud (importacion_id);

CREATE TABLE reservas.patron_recurrencia (
  solicitud_id uuid NOT NULL REFERENCES reservas.solicitud (id) ON DELETE CASCADE,
  dia_semana   smallint NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),
  hora_inicio  time NOT NULL,
  hora_fin     time NOT NULL,
  PRIMARY KEY (solicitud_id, dia_semana, hora_inicio),
  CHECK (hora_fin > hora_inicio),
  CONSTRAINT patron_sin_solape EXCLUDE USING gist (
    solicitud_id WITH =, dia_semana WITH =, institucion.rango_hora(hora_inicio, hora_fin) WITH &&)
);

CREATE TABLE reservas.reserva (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id   uuid NOT NULL REFERENCES reservas.solicitud (id),
  espacio_id     uuid NOT NULL REFERENCES institucion.espacio (id),
  inicio         timestamptz NOT NULL,
  fin            timestamptz NOT NULL,
  estado         reservas.estado_reserva NOT NULL DEFAULT 'PENDIENTE',
  expira_en      timestamptz, -- plazo del bloqueo mientras está pendiente (D12)
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CHECK (fin > inicio),
  CHECK (fin - inicio <= interval '24 hours'),
  CONSTRAINT reserva_pendiente_con_plazo CHECK (estado <> 'PENDIENTE' OR expira_en IS NOT NULL),
  -- R1: ninguna sala con dos reservas activas que se solapen. Intervalo [inicio, fin).
  CONSTRAINT reserva_sin_choque EXCLUDE USING gist (
    espacio_id WITH =, tstzrange(inicio, fin, '[)') WITH &&)
    WHERE (estado IN ('PENDIENTE', 'APROBADA'))
);
CREATE INDEX ON reservas.reserva (solicitud_id);
CREATE INDEX ON reservas.reserva (espacio_id, inicio);
CREATE INDEX ON reservas.reserva (inicio) WHERE estado = 'APROBADA'; -- dashboard y proyección
CREATE INDEX reserva_pendientes_por_vencer ON reservas.reserva (expira_en) WHERE estado = 'PENDIENTE';

CREATE TABLE reservas.regla_aprobacion (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- nulo = "cualquiera"; gana la regla de mayor prioridad que coincida
  tipo_espacio_id    uuid REFERENCES institucion.tipo_espacio (id),
  rol_solicitante_id uuid REFERENCES seguridad.rol (id),
  tipo_actividad_id  uuid REFERENCES reservas.tipo_actividad (id),
  accion             reservas.accion_regla NOT NULL,
  rol_aprobador_id   uuid REFERENCES seguridad.rol (id),
  ambito_aprobador   reservas.ambito_aprobador,
  prioridad          integer NOT NULL DEFAULT 0,
  activo             boolean NOT NULL DEFAULT true,
  CONSTRAINT regla_aprobador_coherente CHECK (
    (accion = 'REQUIERE_APROBACION' AND rol_aprobador_id IS NOT NULL AND ambito_aprobador IS NOT NULL)
    OR (accion <> 'REQUIERE_APROBACION' AND rol_aprobador_id IS NULL AND ambito_aprobador IS NULL)),
  CONSTRAINT regla_aprobacion_unica UNIQUE NULLS NOT DISTINCT (tipo_espacio_id, rol_solicitante_id, tipo_actividad_id)
);

CREATE TABLE reservas.aprobacion (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id            uuid NOT NULL UNIQUE REFERENCES reservas.solicitud (id), -- un nivel (D11)
  regla_aprobacion_id     uuid REFERENCES reservas.regla_aprobacion (id),
  decision                reservas.decision NOT NULL,
  decidido_por_usuario_id uuid REFERENCES seguridad.usuario (id), -- nulo = automática (N4)
  decidido_en             timestamptz NOT NULL DEFAULT now(),
  comentario              text,
  CONSTRAINT aprobacion_automatica_solo_aprueba CHECK (decision = 'APROBADA' OR decidido_por_usuario_id IS NOT NULL),
  -- coalesce: un CHECK que evalúa a NULL se considera cumplido
  CONSTRAINT aprobacion_rechazo_con_motivo CHECK (decision = 'APROBADA' OR length(trim(coalesce(comentario, ''))) > 0)
);
CREATE INDEX ON reservas.aprobacion (decidido_por_usuario_id);

CREATE TABLE reservas.check_in (
  reserva_id    uuid PRIMARY KEY REFERENCES reservas.reserva (id),
  usuario_id    uuid NOT NULL REFERENCES seguridad.usuario (id),
  metodo        reservas.metodo_check_in NOT NULL,
  registrado_en timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Reglas de negocio garantizadas por triggers
-- -----------------------------------------------------------------------------

-- Transiciones de estado permitidas (diagrama de estados del modelo)
CREATE FUNCTION reservas.fn_validar_transicion() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.estado = OLD.estado THEN
    RETURN NEW;
  END IF;
  IF NOT ((OLD.estado = 'PENDIENTE' AND NEW.estado IN ('APROBADA', 'RECHAZADA', 'EXPIRADA', 'CANCELADA'))
       OR (OLD.estado = 'APROBADA'  AND NEW.estado IN ('CANCELADA', 'LIBERADA'))) THEN
    RAISE EXCEPTION 'Transición de reserva no permitida: % → %', OLD.estado, NEW.estado
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER reserva_transicion_valida
  BEFORE UPDATE OF estado ON reservas.reserva
  FOR EACH ROW EXECUTE FUNCTION reservas.fn_validar_transicion();

-- Redundancia controlada: la decisión se propaga a las reservas pendientes de la solicitud
CREATE FUNCTION reservas.fn_aplicar_aprobacion() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  afectadas int;
BEGIN
  UPDATE reservas.reserva
     SET estado = NEW.decision::text::reservas.estado_reserva
   WHERE solicitud_id = NEW.solicitud_id
     AND estado = 'PENDIENTE';
  GET DIAGNOSTICS afectadas = ROW_COUNT;
  IF afectadas = 0 THEN
    RAISE EXCEPTION 'La solicitud % no tiene reservas pendientes (¿expiró o fue cancelada?)', NEW.solicitud_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER aprobacion_aplica_a_reservas
  AFTER INSERT ON reservas.aprobacion
  FOR EACH ROW EXECUTE FUNCTION reservas.fn_aplicar_aprobacion();

-- Una decisión es definitiva: para revertirla se cancelan las reservas
CREATE FUNCTION auditoria.fn_solo_insercion() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La tabla %.% es de solo inserción', TG_TABLE_SCHEMA, TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END $$;

CREATE TRIGGER aprobacion_inmutable
  BEFORE UPDATE OR DELETE ON reservas.aprobacion
  FOR EACH ROW EXECUTE FUNCTION auditoria.fn_solo_insercion();

-- Check-in: solo en reservas aprobadas y dentro del horario (con anticipación configurable)
CREATE FUNCTION reservas.fn_validar_check_in() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  r reservas.reserva;
  anticipacion interval;
BEGIN
  SELECT * INTO r FROM reservas.reserva WHERE id = NEW.reserva_id;
  SELECT make_interval(mins => valor::int) INTO anticipacion
    FROM institucion.parametro WHERE clave = 'reserva.minutos_anticipacion_check_in';
  anticipacion := coalesce(anticipacion, interval '15 minutes');
  IF r.estado <> 'APROBADA' THEN
    RAISE EXCEPTION 'Solo se puede hacer check-in en una reserva aprobada (estado: %)', r.estado
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.registrado_en < r.inicio - anticipacion OR NEW.registrado_en >= r.fin THEN
    RAISE EXCEPTION 'El check-in debe hacerse entre % antes del inicio y el término de la reserva', anticipacion
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER check_in_valido
  BEFORE INSERT ON reservas.check_in
  FOR EACH ROW EXECUTE FUNCTION reservas.fn_validar_check_in();

-- Vencimiento de pendientes (D12). La API lo llama por espacio antes de crear una solicitud,
-- y un proceso programado lo llama sin argumento cada minuto.
CREATE FUNCTION reservas.expirar_pendientes(p_espacio_id uuid DEFAULT NULL) RETURNS integer
LANGUAGE sql AS $$
  WITH vencidas AS (
    UPDATE reservas.reserva
       SET estado = 'EXPIRADA'
     WHERE estado = 'PENDIENTE'
       AND expira_en <= now()
       AND (p_espacio_id IS NULL OR espacio_id = p_espacio_id)
    RETURNING 1)
  SELECT count(*)::int FROM vencidas;
$$;

-- -----------------------------------------------------------------------------
-- Vistas (datos derivados que no se almacenan)
-- -----------------------------------------------------------------------------

-- N1: las filas correctas se calculan, no se guardan
CREATE VIEW reservas.v_importacion_resumen AS
SELECT i.id,
       i.archivo_nombre,
       i.periodo_id,
       i.usuario_id,
       i.creado_en,
       i.total_filas,
       (i.total_filas - coalesce(e.filas_con_error, 0))::int AS filas_ok,
       CASE WHEN i.total_filas = 0 THEN 0
            ELSE round((i.total_filas - coalesce(e.filas_con_error, 0))::numeric / i.total_filas, 4)
       END AS proporcion_ok -- criterio E5: >= 0.98
  FROM reservas.importacion i
  LEFT JOIN (SELECT importacion_id, count(DISTINCT fila) AS filas_con_error
               FROM reservas.importacion_error GROUP BY importacion_id) e ON e.importacion_id = i.id;

-- R7: trazabilidad completa de cada reserva (quién pidió, cuándo, quién aprobó)
CREATE VIEW reservas.v_reserva_trazabilidad AS
SELECT r.id                     AS reserva_id,
       r.inicio,
       r.fin,
       r.estado,
       e.codigo                 AS espacio,
       ed.sede_id,
       s.id                     AS solicitud_id,
       s.origen,
       ta.codigo                AS tipo_actividad,
       s.asistentes,
       s.solicitante_usuario_id,
       s.creado_en              AS solicitado_en,
       a.decision,
       a.decidido_por_usuario_id,
       a.decidido_en,
       a.decidido_en - s.creado_en AS tiempo_aprobacion -- indicador B6
  FROM reservas.reserva r
  JOIN reservas.solicitud s       ON s.id = r.solicitud_id
  JOIN reservas.tipo_actividad ta ON ta.id = s.tipo_actividad_id
  JOIN institucion.espacio e      ON e.id = r.espacio_id
  JOIN institucion.edificio ed    ON ed.id = e.edificio_id
  LEFT JOIN reservas.aprobacion a ON a.solicitud_id = s.id;
