-- =============================================================================
-- Datos de DEMOSTRACIÓN para desarrollo y pruebas de la API. Nunca en producción.
-- Usuarios con contraseña "reservaitn". Idempotente.
-- =============================================================================
INSERT INTO institucion.sede (institucion_id, codigo, nombre, direccion, comuna)
SELECT id, v.codigo, v.nombre, v.direccion, 'Arica' FROM institucion.institucion,
  (VALUES ('CENTRO', 'Sede Centro', 'Av. Principal 100'), ('NORTE', 'Sede Norte', 'Calle Norte 200')) AS v(codigo, nombre, direccion)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO institucion.horario_sede (sede_id, dia_semana, apertura, cierre)
SELECT s.id, d, '08:00', CASE WHEN d = 6 THEN '14:00'::time ELSE '23:00'::time END
  FROM institucion.sede s, generate_series(1, 6) d
ON CONFLICT DO NOTHING;

INSERT INTO institucion.edificio (sede_id, codigo, nombre)
SELECT s.id, v.codigo, v.nombre FROM institucion.sede s
  JOIN (VALUES ('CENTRO', 'A', 'Edificio A'), ('CENTRO', 'B', 'Edificio B'), ('NORTE', 'N', 'Edificio Norte')) AS v(sede, codigo, nombre)
    ON v.sede = s.codigo
ON CONFLICT (sede_id, codigo) DO NOTHING;

INSERT INTO institucion.espacio (edificio_id, tipo_espacio_id, codigo, nombre, piso, capacidad, accesible)
SELECT e.id, te.id, v.codigo, v.nombre, v.piso, v.capacidad, v.accesible
  FROM (VALUES
    ('CENTRO', 'A', 'SALA',         'A-101',    'Sala A-101', 1, 40, true),
    ('CENTRO', 'A', 'SALA',         'A-102',    'Sala A-102', 1, 30, true),
    ('CENTRO', 'A', 'SALA',         'A-201',    'Sala A-201', 2, 35, false),
    ('CENTRO', 'B', 'LABORATORIO',  'LAB-INF1', 'Laboratorio de Informática 1', 1, 25, true),
    ('CENTRO', 'B', 'AUDITORIO',    'AUD-1',    'Auditorio', 1, 120, true),
    ('CENTRO', 'B', 'SALA_ESTUDIO', 'EST-1',    'Sala de estudio', 2, 8, false),
    ('NORTE',  'N', 'SALA',         'N-101',    'Sala N-101', 1, 50, true),
    ('NORTE',  'N', 'LABORATORIO',  'LAB-ENF',  'Laboratorio de Enfermería', 1, 20, true)
  ) AS v(sede, edificio, tipo, codigo, nombre, piso, capacidad, accesible)
  JOIN institucion.sede s         ON s.codigo = v.sede
  JOIN institucion.edificio e     ON e.sede_id = s.id AND e.codigo = v.edificio
  JOIN institucion.tipo_espacio te ON te.codigo = v.tipo
ON CONFLICT (edificio_id, codigo) DO NOTHING;

INSERT INTO institucion.espacio_item (espacio_id, item_id, cantidad_esperada)
SELECT e.id, i.id, v.cantidad
  FROM (VALUES
    ('A-101', 'SILLA', 40), ('A-101', 'MESA', 20), ('A-101', 'PROYECTOR', 1),
    ('A-102', 'SILLA', 30), ('A-102', 'PROYECTOR', 1),
    ('A-201', 'SILLA', 35), ('A-201', 'TELEVISOR', 1),
    ('LAB-INF1', 'COMPUTADOR', 25), ('LAB-INF1', 'SILLA', 25), ('LAB-INF1', 'PROYECTOR', 1),
    ('AUD-1', 'SILLA', 120), ('AUD-1', 'PROYECTOR', 1), ('AUD-1', 'PARLANTE', 1),
    ('EST-1', 'SILLA', 8), ('EST-1', 'MESA', 2),
    ('N-101', 'SILLA', 50), ('N-101', 'PROYECTOR', 1),
    ('LAB-ENF', 'CAMILLA', 6), ('LAB-ENF', 'SILLA', 20)
  ) AS v(espacio, item, cantidad)
  JOIN institucion.espacio e ON e.codigo = v.espacio
  JOIN institucion.item i    ON i.codigo = v.item
ON CONFLICT DO NOTHING;

INSERT INTO academico.carrera (codigo, nombre) VALUES
  ('INF', 'Técnico en Informática'), ('ENF', 'Técnico en Enfermería')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO institucion.espacio_carrera (espacio_id, carrera_id, prioridad)
SELECT e.id, c.id, 'EXCLUSIVO' FROM (VALUES ('LAB-INF1', 'INF'), ('LAB-ENF', 'ENF')) AS v(espacio, carrera)
  JOIN institucion.espacio e ON e.codigo = v.espacio
  JOIN academico.carrera c   ON c.codigo = v.carrera
ON CONFLICT DO NOTHING;

INSERT INTO academico.oferta_carrera (carrera_id, sede_id, jornada)
SELECT c.id, s.id, v.jornada::institucion.jornada
  FROM (VALUES ('INF', 'CENTRO', 'DIURNA'), ('INF', 'CENTRO', 'VESPERTINA'), ('ENF', 'NORTE', 'DIURNA')) AS v(carrera, sede, jornada)
  JOIN academico.carrera c ON c.codigo = v.carrera
  JOIN institucion.sede s  ON s.codigo = v.sede
ON CONFLICT DO NOTHING;

INSERT INTO academico.periodo_academico (codigo, nombre, fecha_inicio, fecha_fin, estado) VALUES
  ('2026-2', 'Segundo semestre 2026', '2026-08-03', '2026-12-18', 'EN_CURSO'),
  ('2027-1', 'Primer semestre 2027',  '2027-03-08', '2027-07-16', 'PLANIFICACION')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO seguridad.persona (tipo_documento, numero_documento, nombres, apellido_paterno, email)
VALUES
  ('RUT', '11111111-1', 'Pedro',     'Fernández',           'subdireccion@itn.cl'),
  ('RUT', '22222222-2', 'Francisca', 'Urrutia',             'datd@itn.cl'),
  ('RUT', '33333333-3', 'Dirección', 'Académica',           'academica@itn.cl'),
  ('RUT', '44444444-4', 'Director',  'Informática',         'dir.inf@itn.cl'),
  ('RUT', '55555555-5', 'Docente',   'Demo',                'docente@itn.cl'),
  ('RUT', '66666666-6', 'Estudiante','Demo',                'estudiante@itn.cl'),
  ('RUT', '77777777-7', 'Encargado', 'Operaciones',         'operaciones@itn.cl'),
  ('RUT', '88888888-8', 'Personal',  'Aseo',                'aseo@itn.cl'),
  ('RUT', '99999999-9', 'Directora', 'Enfermería',          'dir.enf@itn.cl')
ON CONFLICT (tipo_documento, numero_documento) DO NOTHING;

INSERT INTO seguridad.usuario (persona_id, password_hash)
SELECT id, '$2a$10$RLuV4cQioQ5UvG3OrsQtEOEemKJnvlS1Z.Wbq7kjEnnG1xXnQITgy' FROM seguridad.persona WHERE email LIKE '%@itn.cl'
ON CONFLICT (persona_id) DO NOTHING;

INSERT INTO seguridad.usuario_rol (usuario_id, rol_id, carrera_id)
SELECT u.id, r.id, c.id
  FROM (VALUES
    ('subdireccion@itn.cl', 'SUBDIRECCION', NULL),
    ('datd@itn.cl',         'DATD', NULL),
    ('academica@itn.cl',    'DIRECCION_ACADEMICA', NULL),
    ('dir.inf@itn.cl',      'DIRECTOR_CARRERA', 'INF'),
    ('dir.inf@itn.cl',      'DOCENTE', 'INF'),  -- un director también es docente (D2)
    ('docente@itn.cl',      'DOCENTE', 'INF'),
    ('estudiante@itn.cl',   'ESTUDIANTE', NULL),
    ('operaciones@itn.cl',  'OPERACIONES', NULL),
    ('aseo@itn.cl',         'ASEO_MANTENCION', NULL),
    ('dir.enf@itn.cl',      'DIRECTOR_CARRERA', 'ENF')
  ) AS v(email, rol, carrera)
  JOIN seguridad.persona p  ON p.email = v.email
  JOIN seguridad.usuario u  ON u.persona_id = p.id
  JOIN seguridad.rol r      ON r.codigo = v.rol
  LEFT JOIN academico.carrera c ON c.codigo = v.carrera
ON CONFLICT DO NOTHING;

-- La estudiante está matriculada en Informática diurna, período vigente
INSERT INTO academico.matricula (persona_id, oferta_carrera_id, periodo_id)
SELECT p.id, oc.id, pa.id
  FROM seguridad.persona p, academico.oferta_carrera oc
  JOIN academico.carrera c ON c.id = oc.carrera_id AND c.codigo = 'INF'
  JOIN institucion.sede s  ON s.id = oc.sede_id AND s.codigo = 'CENTRO',
       academico.periodo_academico pa
 WHERE p.email = 'estudiante@itn.cl' AND oc.jornada = 'DIURNA' AND pa.codigo = '2026-2'
ON CONFLICT DO NOTHING;
