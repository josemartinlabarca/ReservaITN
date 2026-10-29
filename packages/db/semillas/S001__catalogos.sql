-- =============================================================================
-- Catálogos iniciales. Idempotente: se puede ejecutar varias veces.
-- Los valores marcados (propuesta) deben validarse con el cliente.
-- =============================================================================

INSERT INTO institucion.institucion (nombre) VALUES ('Instituto Técnico del Norte')
ON CONFLICT (unica) DO NOTHING;

INSERT INTO institucion.parametro (clave, valor, tipo, descripcion) VALUES
  ('reserva.minutos_bloqueo_pendiente',     '1440', 'ENTERO', 'Plazo en que una solicitud pendiente bloquea el horario (propuesta: 24 h)'),
  ('reserva.minutos_liberacion_sin_check_in', '15', 'ENTERO', 'Minutos desde el inicio sin check-in para liberar la reserva (propuesta)'),
  ('reserva.minutos_anticipacion_check_in',   '15', 'ENTERO', 'Minutos antes del inicio en que se permite el check-in'),
  ('reserva.dias_anticipacion_maxima',       '120', 'ENTERO', 'Máximo de días de anticipación para reservar'),
  ('reserva.minutos_duracion_minima',         '30', 'ENTERO', 'Duración mínima de una reserva'),
  ('sugerencia.minutos_ventana_liberacion',   '30', 'ENTERO', 'Salas que se liberan dentro de esta ventana se ofrecen como alternativa (R10)'),
  ('aprobacion.horas_meta',                   '24', 'ENTERO', 'Meta de tiempo de aprobación (indicador B6)')
ON CONFLICT (clave) DO NOTHING;

INSERT INTO seguridad.tipo_documento (codigo, nombre, valida_digito) VALUES
  ('RUT', 'RUT chileno', true),
  ('PAS', 'Pasaporte', false),
  ('DNI', 'Documento nacional de identidad extranjero', false)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO seguridad.rol (codigo, nombre, es_sistema) VALUES
  ('ESTUDIANTE',          'Estudiante', true),
  ('DOCENTE',             'Docente', true),
  ('DIRECTOR_CARRERA',    'Director de carrera', true),
  ('DIRECCION_ACADEMICA', 'Dirección académica', true),
  ('SUBDIRECCION',        'Subdirección', true),
  ('DATD',                'Dirección de Administración y Transformación Digital', true),
  ('OPERACIONES',         'Encargado de operaciones', true),
  ('ASEO_MANTENCION',     'Aseo y mantención', true),
  ('ADMIN_TI',            'Encargado de informática', true)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO seguridad.permiso (codigo, modulo, descripcion) VALUES
  ('reserva:solicitar',           'reservas',     'Solicitar reservas'),
  ('reserva:aprobar',             'reservas',     'Aprobar o rechazar solicitudes'),
  ('reserva:cancelar_cualquiera', 'reservas',     'Cancelar reservas de otras personas'),
  ('recurso:gestionar',           'institucion',  'Administrar sedes, edificios y espacios'),
  ('planificacion:importar',      'reservas',     'Importar la planificación semestral'),
  ('dashboard:ver',               'reportes',     'Ver el dashboard de ocupación'),
  ('reporte:generar',             'reportes',     'Generar reportes personalizados'),
  ('mantencion:planificar',       'mantencion',   'Planificar mantención y liberar reservas'),
  ('inventario:registrar',        'mantencion',   'Registrar inspecciones de inventario'),
  ('danio:reportar',              'mantencion',   'Reportar daños'),
  ('danio:gestionar',             'mantencion',   'Gestionar órdenes de trabajo'),
  ('usuario:gestionar',           'seguridad',    'Administrar usuarios y roles'),
  ('regla:gestionar',             'reservas',     'Administrar reglas de aprobación y parámetros')
ON CONFLICT (codigo) DO NOTHING;

-- Matriz rol → permiso (equivalente a packages/shared/src/roles.ts)
INSERT INTO seguridad.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM (VALUES
    ('ESTUDIANTE', 'reserva:solicitar'),
    ('DOCENTE', 'reserva:solicitar'),
    ('DIRECTOR_CARRERA', 'reserva:solicitar'), ('DIRECTOR_CARRERA', 'reserva:aprobar'),
    ('DIRECTOR_CARRERA', 'dashboard:ver'), ('DIRECTOR_CARRERA', 'reporte:generar'),
    ('DIRECCION_ACADEMICA', 'reserva:solicitar'), ('DIRECCION_ACADEMICA', 'reserva:aprobar'),
    ('DIRECCION_ACADEMICA', 'planificacion:importar'), ('DIRECCION_ACADEMICA', 'dashboard:ver'),
    ('DIRECCION_ACADEMICA', 'reporte:generar'),
    ('SUBDIRECCION', 'reserva:solicitar'), ('SUBDIRECCION', 'reserva:aprobar'),
    ('SUBDIRECCION', 'reserva:cancelar_cualquiera'), ('SUBDIRECCION', 'dashboard:ver'),
    ('SUBDIRECCION', 'reporte:generar'), ('SUBDIRECCION', 'recurso:gestionar'),
    ('DATD', 'dashboard:ver'), ('DATD', 'reporte:generar'), ('DATD', 'usuario:gestionar'),
    ('DATD', 'regla:gestionar'),
    ('OPERACIONES', 'recurso:gestionar'), ('OPERACIONES', 'planificacion:importar'),
    ('OPERACIONES', 'mantencion:planificar'), ('OPERACIONES', 'danio:gestionar'),
    ('OPERACIONES', 'dashboard:ver'),
    ('ASEO_MANTENCION', 'inventario:registrar'), ('ASEO_MANTENCION', 'danio:reportar'),
    ('ADMIN_TI', 'usuario:gestionar'), ('ADMIN_TI', 'recurso:gestionar'),
    ('ADMIN_TI', 'planificacion:importar'), ('ADMIN_TI', 'regla:gestionar')
  ) AS m(rol, permiso)
  JOIN seguridad.rol r ON r.codigo = m.rol
  JOIN seguridad.permiso p ON p.codigo = m.permiso
ON CONFLICT DO NOTHING;

INSERT INTO institucion.tipo_espacio (codigo, nombre, requiere_aprobacion, reservable_por_estudiantes) VALUES
  ('SALA',        'Sala de clases', true, true),
  ('LABORATORIO', 'Laboratorio', true, false),
  ('AUDITORIO',   'Auditorio', true, false),
  ('TALLER',      'Taller', true, false),
  ('SALA_ESTUDIO','Sala de estudio', false, true)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO institucion.item (codigo, nombre, categoria, filtrable) VALUES
  ('SILLA',       'Silla', 'MOBILIARIO', false),
  ('MESA',        'Mesa', 'MOBILIARIO', false),
  ('PIZARRA',     'Pizarra', 'MOBILIARIO', false),
  ('PROYECTOR',   'Proyector', 'TECNOLOGIA', true),
  ('TELEVISOR',   'Televisor', 'TECNOLOGIA', true),
  ('COMPUTADOR',  'Computador', 'TECNOLOGIA', true),
  ('PARLANTE',    'Sistema de audio', 'TECNOLOGIA', true),
  ('AIRE_ACOND',  'Aire acondicionado', 'OTRO', true),
  ('CAMILLA',     'Camilla clínica', 'CLINICO', true)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO reservas.tipo_actividad (codigo, nombre) VALUES
  ('CLASE',      'Clase'),
  ('EVALUACION', 'Evaluación'),
  ('ESTUDIO',    'Estudio'),
  ('REUNION',    'Reunión'),
  ('EVENTO',     'Evento'),
  ('MANTENCION', 'Mantención o aseo')
ON CONFLICT (codigo) DO NOTHING;

-- Reglas de aprobación (propuesta, D11). Nulo = cualquiera; gana la de mayor prioridad.
INSERT INTO reservas.regla_aprobacion
  (tipo_espacio_id, rol_solicitante_id, tipo_actividad_id, accion, rol_aprobador_id, ambito_aprobador, prioridad)
SELECT te.id, rs.id, ta.id, v.accion::reservas.accion_regla, ra.id, v.ambito::reservas.ambito_aprobador, v.prioridad
  FROM (VALUES
    (NULL,          'SUBDIRECCION',        NULL,         'AUTO_APROBAR',        NULL,                  NULL,                  100),
    (NULL,          'DIRECCION_ACADEMICA', NULL,         'AUTO_APROBAR',        NULL,                  NULL,                  100),
    (NULL,          'OPERACIONES',         'MANTENCION', 'AUTO_APROBAR',        NULL,                  NULL,                  100),
    (NULL,          'ASEO_MANTENCION',     NULL,         'PROHIBIDO',           NULL,                  NULL,                  100),
    ('AUDITORIO',   NULL,                  NULL,         'REQUIERE_APROBACION', 'SUBDIRECCION',        'INSTITUCION',          60),
    ('SALA',        'DOCENTE',             NULL,         'REQUIERE_APROBACION', 'DIRECTOR_CARRERA',    'CARRERA_SOLICITANTE',  50),
    ('LABORATORIO', NULL,                  NULL,         'REQUIERE_APROBACION', 'DIRECTOR_CARRERA',    'CARRERA_ESPACIO',      40),
    (NULL,          'ESTUDIANTE',          NULL,         'REQUIERE_APROBACION', 'DIRECTOR_CARRERA',    'CARRERA_SOLICITANTE',  30),
    (NULL,          NULL,                  NULL,         'REQUIERE_APROBACION', 'DIRECCION_ACADEMICA', 'INSTITUCION',           0)
  ) AS v(tipo_espacio, rol_solicitante, actividad, accion, rol_aprobador, ambito, prioridad)
  LEFT JOIN institucion.tipo_espacio te ON te.codigo = v.tipo_espacio
  LEFT JOIN seguridad.rol rs            ON rs.codigo = v.rol_solicitante
  LEFT JOIN reservas.tipo_actividad ta  ON ta.codigo = v.actividad
  LEFT JOIN seguridad.rol ra            ON ra.codigo = v.rol_aprobador
ON CONFLICT DO NOTHING;

INSERT INTO comunicacion.evento_notificacion (codigo, descripcion, obligatorio) VALUES
  ('SOLICITUD_CREADA',    'Llega una solicitud que usted debe aprobar', true),
  ('SOLICITUD_APROBADA',  'Su solicitud fue aprobada', false),
  ('SOLICITUD_RECHAZADA', 'Su solicitud fue rechazada', true),
  ('SOLICITUD_EXPIRADA',  'Su solicitud venció sin respuesta', true),
  ('RESERVA_CANCELADA',   'Una reserva suya fue cancelada', true),
  ('RESERVA_LIBERADA',    'Su reserva se liberó por falta de check-in', true),
  ('RESERVA_RECORDATORIO','Recordatorio antes de una reserva', false),
  ('DANIO_REPORTADO',     'Se reportó un daño en una sala', false),
  ('ORDEN_ASIGNADA',      'Se le asignó una orden de trabajo', true)
ON CONFLICT (codigo) DO NOTHING;
