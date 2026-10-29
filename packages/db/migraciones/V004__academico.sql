-- =============================================================================
-- V004 · Esquema academico
-- =============================================================================
CREATE TYPE academico.estado_periodo   AS ENUM ('PLANIFICACION', 'EN_CURSO', 'CERRADO');
CREATE TYPE academico.estado_matricula AS ENUM ('VIGENTE', 'SUSPENDIDA', 'RETIRADA', 'EGRESADA');

CREATE TABLE academico.periodo_academico (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo       text NOT NULL UNIQUE CHECK (codigo ~ '^[0-9]{4}-[1-3]$'), -- 2027-1
  nombre       text NOT NULL,
  fecha_inicio date NOT NULL,
  fecha_fin    date NOT NULL,
  estado       academico.estado_periodo NOT NULL DEFAULT 'PLANIFICACION',
  CHECK (fecha_fin > fecha_inicio),
  CONSTRAINT periodo_sin_solape EXCLUDE USING gist (
    daterange(fecha_inicio, fecha_fin, '[]') WITH &&)
);

CREATE TABLE academico.carrera (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo         text NOT NULL UNIQUE CHECK (codigo ~ '^[A-Z0-9-]{2,20}$'),
  nombre         text NOT NULL,
  activo         boolean NOT NULL DEFAULT true,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE academico.oferta_carrera (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrera_id uuid NOT NULL REFERENCES academico.carrera (id),
  sede_id    uuid NOT NULL REFERENCES institucion.sede (id),
  jornada    institucion.jornada NOT NULL,
  activo     boolean NOT NULL DEFAULT true,
  UNIQUE (carrera_id, sede_id, jornada)
);
CREATE INDEX ON academico.oferta_carrera (sede_id);

CREATE TABLE academico.asignatura (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo                     text NOT NULL UNIQUE CHECK (codigo ~ '^[A-Z0-9-]{2,20}$'),
  nombre                     text NOT NULL,
  horas_semanales            smallint NOT NULL CHECK (horas_semanales BETWEEN 1 AND 40),
  tipo_espacio_requerido_id  uuid REFERENCES institucion.tipo_espacio (id), -- ej. requiere laboratorio
  creado_en                  timestamptz NOT NULL DEFAULT now(),
  actualizado_en             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE academico.carrera_asignatura (
  carrera_id    uuid NOT NULL REFERENCES academico.carrera (id),
  asignatura_id uuid NOT NULL REFERENCES academico.asignatura (id),
  nivel         smallint NOT NULL CHECK (nivel BETWEEN 1 AND 12),
  PRIMARY KEY (carrera_id, asignatura_id)
);
CREATE INDEX ON academico.carrera_asignatura (asignatura_id);

CREATE TABLE academico.seccion (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id         uuid NOT NULL REFERENCES academico.periodo_academico (id),
  asignatura_id      uuid NOT NULL REFERENCES academico.asignatura (id),
  oferta_carrera_id  uuid NOT NULL REFERENCES academico.oferta_carrera (id),
  codigo             text NOT NULL CHECK (codigo ~ '^[A-Z0-9-]{1,10}$'),
  docente_persona_id uuid REFERENCES seguridad.persona (id),
  cupo               integer NOT NULL CHECK (cupo > 0),
  inscritos          integer NOT NULL DEFAULT 0 CHECK (inscritos >= 0),
  creado_en          timestamptz NOT NULL DEFAULT now(),
  actualizado_en     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (periodo_id, asignatura_id, oferta_carrera_id, codigo)
);
CREATE INDEX ON academico.seccion (docente_persona_id);
CREATE INDEX ON academico.seccion (oferta_carrera_id);

CREATE TABLE academico.matricula (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id        uuid NOT NULL REFERENCES seguridad.persona (id),
  oferta_carrera_id uuid NOT NULL REFERENCES academico.oferta_carrera (id),
  periodo_id        uuid NOT NULL REFERENCES academico.periodo_academico (id),
  estado            academico.estado_matricula NOT NULL DEFAULT 'VIGENTE',
  creado_en         timestamptz NOT NULL DEFAULT now(),
  actualizado_en    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (persona_id, oferta_carrera_id, periodo_id)
);
CREATE INDEX ON academico.matricula (oferta_carrera_id, periodo_id);
