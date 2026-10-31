-- =============================================================================
-- V012 · Reintentos con espera creciente en la cola de envíos (R6)
-- El despachador toma solo los envíos cuyo próximo intento ya llegó; si falla, la API
-- programa el siguiente a 1, 2, 4, 8… minutos hasta el máximo de intentos (parámetro).
-- =============================================================================
ALTER TABLE comunicacion.envio
  ADD COLUMN proximo_intento timestamptz NOT NULL DEFAULT now();

DROP INDEX comunicacion.envio_pendientes;
CREATE INDEX envio_pendientes ON comunicacion.envio (proximo_intento) WHERE estado = 'PENDIENTE';

COMMENT ON COLUMN comunicacion.envio.proximo_intento IS 'Cuándo puede intentarse de nuevo (espera creciente tras cada fallo)';
