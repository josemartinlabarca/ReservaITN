-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ESTUDIANTE', 'DOCENTE', 'DIRECTOR_CARRERA', 'DIRECCION_ACADEMICA', 'SUBDIRECCION', 'DATD', 'OPERACIONES', 'ASEO_MANTENCION', 'ADMIN_TI');

-- CreateEnum
CREATE TYPE "TipoRecurso" AS ENUM ('SALA', 'LABORATORIO');

-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA', 'LIBERADA');

-- CreateEnum
CREATE TYPE "OrigenReserva" AS ENUM ('SOLICITUD', 'PLANIFICACION', 'MANTENCION');

-- CreateEnum
CREATE TYPE "SeveridadDanio" AS ENUM ('BAJA', 'MEDIA', 'ALTA');

-- CreateEnum
CREATE TYPE "EstadoDanio" AS ENUM ('ABIERTO', 'EN_PROCESO', 'RESUELTO');

-- CreateTable
CREATE TABLE "sedes" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sedes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carreras" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "carreras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "rut" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "password_hash" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "carrera_id" UUID,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salas" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoRecurso" NOT NULL,
    "capacidad" INTEGER NOT NULL,
    "equipamiento" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "sede_id" UUID NOT NULL,
    "carrera_exclusiva_id" UUID,

    CONSTRAINT "salas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas" (
    "id" UUID NOT NULL,
    "sala_id" UUID NOT NULL,
    "solicitante_id" UUID NOT NULL,
    "aprobador_id" UUID,
    "inicio" TIMESTAMPTZ(3) NOT NULL,
    "fin" TIMESTAMPTZ(3) NOT NULL,
    "motivo" TEXT NOT NULL,
    "asistentes" INTEGER NOT NULL,
    "estado" "EstadoReserva" NOT NULL DEFAULT 'PENDIENTE',
    "origen" "OrigenReserva" NOT NULL DEFAULT 'SOLICITUD',
    "decidida_en" TIMESTAMP(3),
    "check_in_en" TIMESTAMP(3),
    "importacion_id" UUID,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizada_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_reserva" (
    "id" UUID NOT NULL,
    "reserva_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "accion" TEXT NOT NULL,
    "estado_anterior" "EstadoReserva",
    "estado_nuevo" "EstadoReserva" NOT NULL,
    "comentario" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_reserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "reserva_id" UUID,
    "titulo" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "enviada_en" TIMESTAMP(3),
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "importaciones" (
    "id" UUID NOT NULL,
    "archivo_nombre" TEXT NOT NULL,
    "usuario_id" UUID NOT NULL,
    "total_filas" INTEGER NOT NULL,
    "filas_ok" INTEGER NOT NULL,
    "errores" JSONB NOT NULL DEFAULT '[]',
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "importaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items_inventario" (
    "id" UUID NOT NULL,
    "sala_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "cantidad_esperada" INTEGER NOT NULL,

    CONSTRAINT "items_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conteos_inventario" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conteos_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reportes_danio" (
    "id" UUID NOT NULL,
    "sala_id" UUID NOT NULL,
    "reportado_por_id" UUID NOT NULL,
    "descripcion" TEXT NOT NULL,
    "severidad" "SeveridadDanio" NOT NULL,
    "foto_url" TEXT,
    "estado" "EstadoDanio" NOT NULL DEFAULT 'ABIERTO',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resuelto_en" TIMESTAMP(3),

    CONSTRAINT "reportes_danio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sedes_nombre_key" ON "sedes"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "carreras_codigo_key" ON "carreras"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_rut_key" ON "usuarios"("rut");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "salas_sede_id_codigo_key" ON "salas"("sede_id", "codigo");

-- CreateIndex
CREATE INDEX "reservas_sala_id_inicio_idx" ON "reservas"("sala_id", "inicio");

-- CreateIndex
CREATE INDEX "reservas_estado_idx" ON "reservas"("estado");

-- CreateIndex
CREATE INDEX "eventos_reserva_reserva_id_idx" ON "eventos_reserva"("reserva_id");

-- CreateIndex
CREATE INDEX "notificaciones_usuario_id_leida_idx" ON "notificaciones"("usuario_id", "leida");

-- CreateIndex
CREATE UNIQUE INDEX "items_inventario_sala_id_nombre_key" ON "items_inventario"("sala_id", "nombre");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_carrera_id_fkey" FOREIGN KEY ("carrera_id") REFERENCES "carreras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salas" ADD CONSTRAINT "salas_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salas" ADD CONSTRAINT "salas_carrera_exclusiva_id_fkey" FOREIGN KEY ("carrera_exclusiva_id") REFERENCES "carreras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_sala_id_fkey" FOREIGN KEY ("sala_id") REFERENCES "salas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_solicitante_id_fkey" FOREIGN KEY ("solicitante_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_aprobador_id_fkey" FOREIGN KEY ("aprobador_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_importacion_id_fkey" FOREIGN KEY ("importacion_id") REFERENCES "importaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_reserva" ADD CONSTRAINT "eventos_reserva_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reservas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_reserva" ADD CONSTRAINT "eventos_reserva_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reservas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importaciones" ADD CONSTRAINT "importaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_inventario" ADD CONSTRAINT "items_inventario_sala_id_fkey" FOREIGN KEY ("sala_id") REFERENCES "salas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conteos_inventario" ADD CONSTRAINT "conteos_inventario_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items_inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conteos_inventario" ADD CONSTRAINT "conteos_inventario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reportes_danio" ADD CONSTRAINT "reportes_danio_sala_id_fkey" FOREIGN KEY ("sala_id") REFERENCES "salas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reportes_danio" ADD CONSTRAINT "reportes_danio_reportado_por_id_fkey" FOREIGN KEY ("reportado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ============================================================================
-- GARANTÍA ANTI-CHOQUES (R1 / E6)
-- Ninguna sala puede tener dos reservas APROBADAS cuyos horarios se solapen.
-- Se aplica en la base de datos, por lo que vale aunque dos aprobadores
-- actúen al mismo tiempo o se cargue la planificación por importación.
-- Intervalo semiabierto [inicio, fin): 08:00–10:00 y 10:00–11:00 no chocan.
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "reservas"
  ADD CONSTRAINT "reservas_fin_posterior" CHECK ("fin" > "inicio");

ALTER TABLE "reservas"
  ADD CONSTRAINT "reservas_sin_choque"
  EXCLUDE USING gist (
    "sala_id" WITH =,
    tstzrange("inicio", "fin", '[)') WITH &&
  ) WHERE ("estado" = 'APROBADA');

-- Trazabilidad inmutable (R7): la bitácora no se modifica ni se borra.
CREATE OR REPLACE FUNCTION bloquear_cambios_bitacora() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'La bitácora de reservas es de solo inserción';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER eventos_reserva_inmutables
  BEFORE UPDATE OR DELETE ON "eventos_reserva"
  FOR EACH ROW EXECUTE FUNCTION bloquear_cambios_bitacora();
