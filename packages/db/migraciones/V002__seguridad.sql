-- =============================================================================
-- V002 · Esquema seguridad (sin usuario_rol, que depende de sede y carrera: V005)
-- =============================================================================
CREATE TYPE seguridad.estado_usuario      AS ENUM ('ACTIVO', 'BLOQUEADO');
CREATE TYPE seguridad.proveedor_identidad AS ENUM ('GOOGLE', 'MICROSOFT');

-- Valida un RUT "12345678-5" con su dígito verificador (módulo 11)
CREATE FUNCTION seguridad.rut_valido(rut text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
  cuerpo text;
  dv     text;
  suma   int := 0;
  factor int := 2;
  resto  int;
BEGIN
  IF rut !~ '^[0-9]{7,8}-[0-9K]$' THEN
    RETURN false;
  END IF;
  cuerpo := split_part(rut, '-', 1);
  dv     := split_part(rut, '-', 2);
  FOR i IN REVERSE length(cuerpo)..1 LOOP
    suma   := suma + substr(cuerpo, i, 1)::int * factor;
    factor := CASE WHEN factor = 7 THEN 2 ELSE factor + 1 END;
  END LOOP;
  resto := 11 - (suma % 11);
  RETURN dv = CASE resto WHEN 11 THEN '0' WHEN 10 THEN 'K' ELSE resto::text END;
END $$;

CREATE TABLE seguridad.tipo_documento (
  codigo        text PRIMARY KEY CHECK (codigo ~ '^[A-Z]{2,5}$'),
  nombre        text NOT NULL,
  valida_digito boolean NOT NULL DEFAULT false
);

CREATE TABLE seguridad.persona (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_documento    text NOT NULL REFERENCES seguridad.tipo_documento (codigo),
  numero_documento  text NOT NULL CHECK (numero_documento ~ '^[0-9A-Z-]{4,20}$'),
  nombres           text NOT NULL CHECK (length(trim(nombres)) > 0),
  apellido_paterno  text NOT NULL CHECK (length(trim(apellido_paterno)) > 0),
  apellido_materno  text,
  email             citext UNIQUE CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  telefono          text CHECK (telefono ~ '^\+?[0-9]{8,15}$'),
  creado_en         timestamptz NOT NULL DEFAULT now(),
  actualizado_en    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tipo_documento, numero_documento),
  CONSTRAINT persona_rut_valido CHECK (tipo_documento <> 'RUT' OR seguridad.rut_valido(numero_documento))
);
COMMENT ON TABLE seguridad.persona IS 'Ser humano; puede existir sin cuenta (ej. docente importado del Excel) — D9';

CREATE TABLE seguridad.usuario (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id     uuid NOT NULL UNIQUE REFERENCES seguridad.persona (id),
  password_hash  text, -- nulo si solo inicia sesión con cuenta institucional (D5)
  estado         seguridad.estado_usuario NOT NULL DEFAULT 'ACTIVO',
  ultimo_acceso  timestamptz,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE seguridad.identidad_externa (
  proveedor  seguridad.proveedor_identidad NOT NULL,
  sujeto     text NOT NULL, -- identificador del usuario en Google o Microsoft
  usuario_id uuid NOT NULL REFERENCES seguridad.usuario (id) ON DELETE CASCADE,
  creado_en  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (proveedor, sujeto)
);
CREATE INDEX ON seguridad.identidad_externa (usuario_id);

CREATE TABLE seguridad.rol (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      text NOT NULL UNIQUE CHECK (codigo ~ '^[A-Z_]+$'),
  nombre      text NOT NULL,
  descripcion text,
  es_sistema  boolean NOT NULL DEFAULT false -- los roles de sistema no se pueden borrar desde la app
);

CREATE TABLE seguridad.permiso (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      text NOT NULL UNIQUE CHECK (codigo ~ '^[a-z_]+:[a-z_]+$'),
  modulo      text NOT NULL,
  descripcion text NOT NULL
);

CREATE TABLE seguridad.rol_permiso (
  rol_id     uuid NOT NULL REFERENCES seguridad.rol (id) ON DELETE CASCADE,
  permiso_id uuid NOT NULL REFERENCES seguridad.permiso (id) ON DELETE CASCADE,
  PRIMARY KEY (rol_id, permiso_id)
);
CREATE INDEX ON seguridad.rol_permiso (permiso_id);
