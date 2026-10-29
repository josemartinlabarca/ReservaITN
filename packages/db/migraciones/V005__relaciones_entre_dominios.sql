-- =============================================================================
-- V005 · Tablas que relacionan dominios (requieren sede y carrera)
-- =============================================================================
CREATE TABLE seguridad.usuario_rol (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    uuid NOT NULL REFERENCES seguridad.usuario (id) ON DELETE CASCADE,
  rol_id        uuid NOT NULL REFERENCES seguridad.rol (id),
  -- Ámbito por combinación (D2): ninguno = institución · solo sede = sede ·
  -- solo carrera = carrera en ambas sedes · carrera + sede = esa oferta
  sede_id       uuid REFERENCES institucion.sede (id),
  carrera_id    uuid REFERENCES academico.carrera (id),
  vigente_desde date NOT NULL DEFAULT current_date,
  vigente_hasta date,
  CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde),
  UNIQUE NULLS NOT DISTINCT (usuario_id, rol_id, sede_id, carrera_id)
);
CREATE INDEX ON seguridad.usuario_rol (rol_id, carrera_id);

CREATE TABLE institucion.espacio_carrera (
  espacio_id uuid NOT NULL REFERENCES institucion.espacio (id) ON DELETE CASCADE,
  carrera_id uuid NOT NULL REFERENCES academico.carrera (id),
  prioridad  institucion.prioridad_espacio NOT NULL,
  PRIMARY KEY (espacio_id, carrera_id)
);
CREATE INDEX ON institucion.espacio_carrera (carrera_id);
