-- =============================================================================
-- V007 · Esquema mantencion
-- =============================================================================
CREATE TYPE mantencion.severidad       AS ENUM ('BAJA', 'MEDIA', 'ALTA');
CREATE TYPE mantencion.tipo_orden      AS ENUM ('CORRECTIVA', 'PREVENTIVA');
CREATE TYPE mantencion.prioridad_orden AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'URGENTE');
CREATE TYPE mantencion.estado_orden    AS ENUM ('ABIERTA', 'ASIGNADA', 'EN_PROCESO', 'RESUELTA', 'CANCELADA');

CREATE TABLE mantencion.inspeccion (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  espacio_id   uuid NOT NULL REFERENCES institucion.espacio (id),
  usuario_id   uuid NOT NULL REFERENCES seguridad.usuario (id),
  realizada_en timestamptz NOT NULL DEFAULT now(),
  observacion  text
);
CREATE INDEX ON mantencion.inspeccion (espacio_id, realizada_en DESC);

CREATE TABLE mantencion.inspeccion_detalle (
  inspeccion_id     uuid NOT NULL REFERENCES mantencion.inspeccion (id) ON DELETE CASCADE,
  item_id           uuid NOT NULL REFERENCES institucion.item (id),
  cantidad_contada  integer NOT NULL CHECK (cantidad_contada >= 0),
  cantidad_esperada integer NOT NULL CHECK (cantidad_esperada >= 0), -- foto del momento
  PRIMARY KEY (inspeccion_id, item_id)
);

CREATE TABLE mantencion.orden_trabajo (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  espacio_id            uuid NOT NULL REFERENCES institucion.espacio (id),
  tipo                  mantencion.tipo_orden NOT NULL,
  prioridad             mantencion.prioridad_orden NOT NULL DEFAULT 'MEDIA',
  estado                mantencion.estado_orden NOT NULL DEFAULT 'ABIERTA',
  asignada_a_usuario_id uuid REFERENCES seguridad.usuario (id),
  solicitud_bloqueo_id  uuid UNIQUE REFERENCES reservas.solicitud (id), -- bloquea la sala (D16)
  solucion              text,
  creado_en             timestamptz NOT NULL DEFAULT now(),
  actualizado_en        timestamptz NOT NULL DEFAULT now(),
  resuelta_en           timestamptz,
  UNIQUE (id, espacio_id), -- destino de la FK compuesta de reporte_danio (N3)
  CONSTRAINT orden_resuelta_con_fecha CHECK ((estado = 'RESUELTA') = (resuelta_en IS NOT NULL)),
  CONSTRAINT orden_resuelta_con_solucion CHECK (estado <> 'RESUELTA' OR length(trim(coalesce(solucion, ''))) > 0),
  CONSTRAINT orden_asignada_con_responsable CHECK (
    estado IN ('ABIERTA', 'CANCELADA') OR asignada_a_usuario_id IS NOT NULL)
);
CREATE INDEX ON mantencion.orden_trabajo (estado, prioridad);
CREATE INDEX ON mantencion.orden_trabajo (asignada_a_usuario_id) WHERE estado IN ('ASIGNADA', 'EN_PROCESO');

CREATE TABLE mantencion.reporte_danio (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  espacio_id               uuid NOT NULL REFERENCES institucion.espacio (id),
  item_id                  uuid REFERENCES institucion.item (id),
  reportado_por_usuario_id uuid NOT NULL REFERENCES seguridad.usuario (id),
  descripcion              text NOT NULL CHECK (length(trim(descripcion)) >= 5),
  severidad                mantencion.severidad NOT NULL,
  orden_trabajo_id         uuid, -- nulo = pendiente de revisión
  creado_en                timestamptz NOT NULL DEFAULT now(),
  -- N3: el reporte solo puede asociarse a una orden de la misma sala
  CONSTRAINT reporte_misma_sala_que_orden FOREIGN KEY (orden_trabajo_id, espacio_id)
    REFERENCES mantencion.orden_trabajo (id, espacio_id)
);
CREATE INDEX ON mantencion.reporte_danio (espacio_id, creado_en DESC);
CREATE INDEX ON mantencion.reporte_danio (orden_trabajo_id);
CREATE INDEX reporte_sin_orden ON mantencion.reporte_danio (creado_en) WHERE orden_trabajo_id IS NULL;

CREATE TABLE mantencion.reporte_danio_foto (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporte_danio_id     uuid NOT NULL REFERENCES mantencion.reporte_danio (id) ON DELETE CASCADE,
  clave_almacenamiento text NOT NULL UNIQUE, -- ruta en el almacenamiento de archivos
  tipo_mime            text NOT NULL CHECK (tipo_mime IN ('image/jpeg', 'image/png', 'image/webp')),
  tamano_bytes         integer NOT NULL CHECK (tamano_bytes BETWEEN 1 AND 10485760), -- máx. 10 MB
  creado_en            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON mantencion.reporte_danio_foto (reporte_danio_id);

-- Diferencias de inventario por inspección (dato derivado, no se almacena)
CREATE VIEW mantencion.v_diferencia_inventario AS
SELECT i.id AS inspeccion_id,
       i.espacio_id,
       i.realizada_en,
       d.item_id,
       d.cantidad_esperada,
       d.cantidad_contada,
       d.cantidad_contada - d.cantidad_esperada AS diferencia
  FROM mantencion.inspeccion i
  JOIN mantencion.inspeccion_detalle d ON d.inspeccion_id = i.id
 WHERE d.cantidad_contada <> d.cantidad_esperada;
