-- =============================================================================
-- V011 · Cancelación con motivo (R5, R7)
-- Una reserva no se borra: se cancela y queda registrado quién, cuándo y por qué.
-- Cancelar la reserva de otra persona (Subdirección) exige motivo.
-- =============================================================================
CREATE TABLE reservas.cancelacion (
  reserva_id     uuid PRIMARY KEY REFERENCES reservas.reserva (id), -- 1:1, como check_in
  usuario_id     uuid NOT NULL REFERENCES seguridad.usuario (id),
  motivo         text,
  cancelado_en   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON reservas.cancelacion (usuario_id);

CREATE FUNCTION reservas.fn_validar_cancelacion() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  r reservas.reserva;
  solicitante uuid;
BEGIN
  SELECT * INTO r FROM reservas.reserva WHERE id = NEW.reserva_id;
  IF r.estado <> 'CANCELADA' THEN
    RAISE EXCEPTION 'Solo se registra la cancelación de una reserva cancelada (estado: %)', r.estado
      USING ERRCODE = 'check_violation';
  END IF;
  SELECT solicitante_usuario_id INTO solicitante FROM reservas.solicitud WHERE id = r.solicitud_id;
  IF NEW.usuario_id <> solicitante AND length(trim(coalesce(NEW.motivo, ''))) < 5 THEN
    RAISE EXCEPTION 'Para cancelar la reserva de otra persona debe indicar el motivo'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER cancelacion_valida
  BEFORE INSERT ON reservas.cancelacion
  FOR EACH ROW EXECUTE FUNCTION reservas.fn_validar_cancelacion();

CREATE TRIGGER cancelacion_inmutable
  BEFORE UPDATE OR DELETE ON reservas.cancelacion
  FOR EACH ROW EXECUTE FUNCTION auditoria.fn_solo_insercion();

CREATE TRIGGER auditar
  AFTER INSERT OR UPDATE OR DELETE ON reservas.cancelacion
  FOR EACH ROW EXECUTE FUNCTION auditoria.fn_auditar();

-- La vista de trazabilidad suma quién canceló, cuándo y por qué (columnas al final)
CREATE OR REPLACE VIEW reservas.v_reserva_trazabilidad AS
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
       a.decidido_en - s.creado_en AS tiempo_aprobacion,
       c.usuario_id             AS cancelado_por_usuario_id,
       c.cancelado_en,
       c.motivo                 AS motivo_cancelacion
  FROM reservas.reserva r
  JOIN reservas.solicitud s       ON s.id = r.solicitud_id
  JOIN reservas.tipo_actividad ta ON ta.id = s.tipo_actividad_id
  JOIN institucion.espacio e      ON e.id = r.espacio_id
  JOIN institucion.edificio ed    ON ed.id = e.edificio_id
  LEFT JOIN reservas.aprobacion a ON a.solicitud_id = s.id
  LEFT JOIN reservas.cancelacion c ON c.reserva_id = r.id;
