-- =============================================================================
-- V010 · Resolución de reglas de aprobación (D11) y liberación sin check-in (R18)
-- La API llama estas funciones: la regla vive en un solo lugar y tiene pruebas.
-- =============================================================================

-- Roles vigentes de un usuario, con su ámbito
CREATE FUNCTION seguridad.roles_vigentes(p_usuario uuid)
RETURNS TABLE (rol_id uuid, codigo text, sede_id uuid, carrera_id uuid)
LANGUAGE sql STABLE AS $$
  SELECT ur.rol_id, r.codigo, ur.sede_id, ur.carrera_id
    FROM seguridad.usuario_rol ur
    JOIN seguridad.rol r ON r.id = ur.rol_id
   WHERE ur.usuario_id = p_usuario
     AND current_date >= ur.vigente_desde
     AND (ur.vigente_hasta IS NULL OR current_date <= ur.vigente_hasta);
$$;

-- Permisos efectivos de un usuario (unión de los permisos de sus roles vigentes)
CREATE FUNCTION seguridad.permisos_de(p_usuario uuid) RETURNS SETOF text
LANGUAGE sql STABLE AS $$
  SELECT DISTINCT p.codigo
    FROM seguridad.roles_vigentes(p_usuario) rv
    JOIN seguridad.rol_permiso rp ON rp.rol_id = rv.rol_id
    JOIN seguridad.permiso p ON p.id = rp.permiso_id;
$$;

-- Carreras a las que pertenece un usuario: ámbito de sus roles + matrículas vigentes
CREATE FUNCTION seguridad.carreras_de(p_usuario uuid) RETURNS SETOF uuid
LANGUAGE sql STABLE AS $$
  SELECT carrera_id FROM seguridad.roles_vigentes(p_usuario) WHERE carrera_id IS NOT NULL
  UNION
  SELECT oc.carrera_id
    FROM academico.matricula m
    JOIN seguridad.usuario u            ON u.persona_id = m.persona_id
    JOIN academico.oferta_carrera oc    ON oc.id = m.oferta_carrera_id
    JOIN academico.periodo_academico pa ON pa.id = m.periodo_id
   WHERE u.id = p_usuario
     AND m.estado = 'VIGENTE'
     AND current_date BETWEEN pa.fecha_inicio AND pa.fecha_fin;
$$;

-- Regla que aplica a una solicitud: la de mayor prioridad y, a igual prioridad, la más específica
CREATE FUNCTION reservas.regla_aplicable(p_solicitante uuid, p_espacio uuid, p_tipo_actividad uuid)
RETURNS reservas.regla_aprobacion
LANGUAGE sql STABLE AS $$
  SELECT r.*
    FROM reservas.regla_aprobacion r
    JOIN institucion.espacio e ON e.id = p_espacio
   WHERE r.activo
     AND (r.tipo_espacio_id IS NULL OR r.tipo_espacio_id = e.tipo_espacio_id)
     AND (r.tipo_actividad_id IS NULL OR r.tipo_actividad_id = p_tipo_actividad)
     AND (r.rol_solicitante_id IS NULL
          OR r.rol_solicitante_id IN (SELECT rol_id FROM seguridad.roles_vigentes(p_solicitante)))
   ORDER BY r.prioridad DESC,
            (r.tipo_espacio_id IS NOT NULL)::int
              + (r.rol_solicitante_id IS NOT NULL)::int
              + (r.tipo_actividad_id IS NOT NULL)::int DESC,
            r.id
   LIMIT 1;
$$;

-- ¿Puede este usuario decidir esta solicitud? (bandeja del aprobador y validación en la API)
CREATE FUNCTION reservas.puede_aprobar(p_usuario uuid, p_solicitud uuid) RETURNS boolean
LANGUAGE plpgsql STABLE AS $$
DECLARE
  s       reservas.solicitud;
  esp     uuid;
  sede    uuid;
  regla   reservas.regla_aprobacion;
BEGIN
  -- Quien tiene el permiso global (Subdirección: "control total") decide cualquier solicitud
  IF 'reserva:aprobar_cualquiera' IN (SELECT seguridad.permisos_de(p_usuario)) THEN
    RETURN true;
  END IF;

  SELECT * INTO s FROM reservas.solicitud WHERE id = p_solicitud;
  SELECT r.espacio_id, ed.sede_id INTO esp, sede
    FROM reservas.reserva r
    JOIN institucion.espacio e   ON e.id = r.espacio_id
    JOIN institucion.edificio ed ON ed.id = e.edificio_id
   WHERE r.solicitud_id = p_solicitud
   ORDER BY r.inicio LIMIT 1;
  IF esp IS NULL THEN
    RETURN false;
  END IF;

  regla := reservas.regla_aplicable(s.solicitante_usuario_id, esp, s.tipo_actividad_id);
  IF regla.accion IS DISTINCT FROM 'REQUIERE_APROBACION' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
      FROM seguridad.roles_vigentes(p_usuario) rv
     WHERE rv.rol_id = regla.rol_aprobador_id
       AND (rv.sede_id IS NULL OR rv.sede_id = sede)
       AND (rv.carrera_id IS NULL -- rol sin carrera: aplica a todas
            OR (regla.ambito_aprobador = 'CARRERA_SOLICITANTE'
                AND rv.carrera_id IN (SELECT seguridad.carreras_de(s.solicitante_usuario_id)))
            OR (regla.ambito_aprobador = 'CARRERA_ESPACIO'
                AND rv.carrera_id IN (SELECT carrera_id FROM institucion.espacio_carrera WHERE espacio_id = esp))));
END $$;

-- Usuarios que deben recibir el aviso de una solicitud nueva
CREATE FUNCTION reservas.aprobadores_de(p_solicitud uuid) RETURNS SETOF uuid
LANGUAGE sql STABLE AS $$
  SELECT DISTINCT ur.usuario_id
    FROM seguridad.usuario_rol ur
    JOIN seguridad.usuario u ON u.id = ur.usuario_id AND u.estado = 'ACTIVO'
   WHERE ur.rol_id = (
           SELECT (reservas.regla_aplicable(s.solicitante_usuario_id, r.espacio_id, s.tipo_actividad_id)).rol_aprobador_id
             FROM reservas.solicitud s
             JOIN reservas.reserva r ON r.solicitud_id = s.id
            WHERE s.id = p_solicitud
            ORDER BY r.inicio LIMIT 1)
     AND reservas.puede_aprobar(ur.usuario_id, p_solicitud);
$$;

-- R18: libera las reservas aprobadas sin check-in pasado el plazo. Devuelve las liberadas
-- para que la API avise al solicitante. Por defecto solo aplica a solicitudes de usuarios;
-- las clases planificadas se incluyen si el parámetro lo indica.
CREATE FUNCTION reservas.liberar_sin_check_in()
RETURNS TABLE (reserva_id uuid, solicitante_usuario_id uuid)
LANGUAGE plpgsql AS $$
DECLARE
  minutos int := coalesce((SELECT valor::int FROM institucion.parametro
                            WHERE clave = 'reserva.minutos_liberacion_sin_check_in'), 15);
  incluir_clases boolean := coalesce((SELECT valor::boolean FROM institucion.parametro
                                       WHERE clave = 'reserva.liberar_clases_planificadas'), false);
BEGIN
  RETURN QUERY
  UPDATE reservas.reserva r
     SET estado = 'LIBERADA'
    FROM reservas.solicitud s
   WHERE s.id = r.solicitud_id
     AND r.estado = 'APROBADA'
     AND r.inicio + make_interval(mins => minutos) <= now()
     AND r.inicio >= now() - interval '1 day' -- no reprocesa el historial
     AND (s.origen = 'SOLICITUD' OR (incluir_clases AND s.origen = 'PLANIFICACION'))
     AND NOT EXISTS (SELECT 1 FROM reservas.check_in c WHERE c.reserva_id = r.id)
  RETURNING r.id, s.solicitante_usuario_id;
END $$;
