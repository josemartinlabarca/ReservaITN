-- =============================================================================
-- V001 · Extensiones, esquemas y funciones comunes
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS btree_gist; -- igualdad (=) en índices GiST, para EXCLUDE
CREATE EXTENSION IF NOT EXISTS citext;     -- correos sin distinguir mayúsculas

CREATE SCHEMA seguridad;
CREATE SCHEMA institucion;
CREATE SCHEMA academico;
CREATE SCHEMA reservas;
CREATE SCHEMA mantencion;
CREATE SCHEMA comunicacion;
CREATE SCHEMA auditoria;

COMMENT ON SCHEMA seguridad    IS 'Personas, cuentas, roles y permisos';
COMMENT ON SCHEMA institucion  IS 'Sedes, edificios, espacios, ítems, calendario y parámetros';
COMMENT ON SCHEMA academico    IS 'Períodos, carreras, ofertas, asignaturas, secciones y matrículas';
COMMENT ON SCHEMA reservas     IS 'Solicitudes, reservas, aprobaciones, check-in e importaciones';
COMMENT ON SCHEMA mantencion   IS 'Inspecciones de inventario, reportes de daño y órdenes de trabajo';
COMMENT ON SCHEMA comunicacion IS 'Notificaciones por app, correo y push';
COMMENT ON SCHEMA auditoria    IS 'Bitácora inmutable de cambios';

-- Mantiene actualizado_en en cada UPDATE (se asocia a las tablas en V008)
CREATE FUNCTION auditoria.fn_marcar_actualizado() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END $$;

-- Rango de horas del día (time no tiene tipo de rango nativo)
CREATE TYPE institucion.rango_hora AS RANGE (subtype = time);
