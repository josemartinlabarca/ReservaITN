-- =============================================================================
-- V003 · Esquema institucion (espacio_carrera en V005)
-- =============================================================================
CREATE TYPE institucion.jornada           AS ENUM ('DIURNA', 'VESPERTINA');
CREATE TYPE institucion.tipo_dia_no_habil AS ENUM ('FERIADO', 'RECESO', 'EVENTO');
CREATE TYPE institucion.prioridad_espacio AS ENUM ('EXCLUSIVO', 'PREFERENTE');
CREATE TYPE institucion.categoria_item    AS ENUM ('MOBILIARIO', 'TECNOLOGIA', 'CLINICO', 'OTRO');
CREATE TYPE institucion.tipo_parametro    AS ENUM ('ENTERO', 'DECIMAL', 'TEXTO', 'BOOLEANO');

CREATE TABLE institucion.institucion (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         text NOT NULL,
  rut            text CHECK (rut IS NULL OR seguridad.rut_valido(rut)),
  zona_horaria   text NOT NULL DEFAULT 'America/Santiago',
  unica          boolean NOT NULL DEFAULT true UNIQUE CHECK (unica), -- una sola fila (D1)
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE institucion.parametro (
  clave          text PRIMARY KEY CHECK (clave ~ '^[a-z_]+(\.[a-z_]+)+$'),
  valor          text NOT NULL,
  tipo           institucion.tipo_parametro NOT NULL,
  descripcion    text NOT NULL,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parametro_valor_segun_tipo CHECK (
    CASE tipo
      WHEN 'ENTERO'   THEN valor ~ '^-?[0-9]+$'
      WHEN 'DECIMAL'  THEN valor ~ '^-?[0-9]+(\.[0-9]+)?$'
      WHEN 'BOOLEANO' THEN valor IN ('true', 'false')
      ELSE true
    END)
);

CREATE TABLE institucion.sede (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id uuid NOT NULL REFERENCES institucion.institucion (id),
  codigo         text NOT NULL UNIQUE CHECK (codigo ~ '^[A-Z0-9-]{2,20}$'),
  nombre         text NOT NULL,
  direccion      text,
  comuna         text,
  activo         boolean NOT NULL DEFAULT true,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE institucion.horario_sede (
  sede_id    uuid NOT NULL REFERENCES institucion.sede (id) ON DELETE CASCADE,
  dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 1 AND 7), -- 1 = lunes (ISO 8601)
  apertura   time NOT NULL,
  cierre     time NOT NULL,
  PRIMARY KEY (sede_id, dia_semana),
  CHECK (cierre > apertura)
);

CREATE TABLE institucion.edificio (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id        uuid NOT NULL REFERENCES institucion.sede (id),
  codigo         text NOT NULL CHECK (codigo ~ '^[A-Z0-9-]{1,20}$'),
  nombre         text NOT NULL,
  activo         boolean NOT NULL DEFAULT true,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sede_id, codigo)
);

CREATE TABLE institucion.tipo_espacio (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo                     text NOT NULL UNIQUE CHECK (codigo ~ '^[A-Z_]+$'),
  nombre                     text NOT NULL,
  requiere_aprobacion        boolean NOT NULL DEFAULT true,
  reservable_por_estudiantes boolean NOT NULL DEFAULT false,
  activo                     boolean NOT NULL DEFAULT true
);

CREATE TABLE institucion.espacio (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edificio_id     uuid NOT NULL REFERENCES institucion.edificio (id),
  tipo_espacio_id uuid NOT NULL REFERENCES institucion.tipo_espacio (id),
  codigo          text NOT NULL CHECK (codigo ~ '^[A-Z0-9-]{1,20}$'),
  nombre          text NOT NULL,
  piso            smallint NOT NULL DEFAULT 1 CHECK (piso BETWEEN -5 AND 50),
  capacidad       integer NOT NULL CHECK (capacidad BETWEEN 1 AND 2000),
  accesible       boolean NOT NULL DEFAULT false,
  reservable      boolean NOT NULL DEFAULT true,
  token_qr        text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''), -- D15
  activo          boolean NOT NULL DEFAULT true,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (edificio_id, codigo)
);
CREATE INDEX ON institucion.espacio (tipo_espacio_id);
COMMENT ON COLUMN institucion.espacio.piso IS 'Atributo y no entidad: un piso no tiene atributos propios';

CREATE TABLE institucion.item (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo    text NOT NULL UNIQUE CHECK (codigo ~ '^[A-Z_]+$'),
  nombre    text NOT NULL,
  categoria institucion.categoria_item NOT NULL,
  filtrable boolean NOT NULL DEFAULT false, -- se usa para buscar o sugerir salas (ej. proyector)
  activo    boolean NOT NULL DEFAULT true
);
COMMENT ON TABLE institucion.item IS 'Catálogo único de equipamiento e inventario (D19)';

CREATE TABLE institucion.espacio_item (
  espacio_id        uuid NOT NULL REFERENCES institucion.espacio (id) ON DELETE CASCADE,
  item_id           uuid NOT NULL REFERENCES institucion.item (id),
  cantidad_esperada integer NOT NULL CHECK (cantidad_esperada > 0),
  PRIMARY KEY (espacio_id, item_id)
);
CREATE INDEX ON institucion.espacio_item (item_id);

CREATE TABLE institucion.bloque_horario (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      text NOT NULL UNIQUE CHECK (codigo ~ '^[A-Z0-9]{1,6}$'),
  jornada     institucion.jornada NOT NULL,
  hora_inicio time NOT NULL,
  hora_fin    time NOT NULL,
  orden       smallint NOT NULL UNIQUE,
  CHECK (hora_fin > hora_inicio),
  CONSTRAINT bloque_sin_solape EXCLUDE USING gist (
    institucion.rango_hora(hora_inicio, hora_fin) WITH &&)
);

CREATE TABLE institucion.dia_no_habil (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha   date NOT NULL,
  sede_id uuid REFERENCES institucion.sede (id), -- nulo = ambas sedes
  tipo    institucion.tipo_dia_no_habil NOT NULL,
  motivo  text NOT NULL,
  UNIQUE NULLS NOT DISTINCT (fecha, sede_id)
);
