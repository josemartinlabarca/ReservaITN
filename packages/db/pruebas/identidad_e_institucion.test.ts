import { afterAll, describe, it, expect } from 'vitest';
import { acepta, cerrar, enTransaccion, mundo, rechaza, uno } from './ayuda';

afterAll(cerrar);

const persona = `INSERT INTO seguridad.persona (tipo_documento, numero_documento, nombres, apellido_paterno, email)
                 VALUES ($1, $2, 'Ana', 'Rojas', $3)`;

describe('seguridad', () => {
  it('valida el dígito verificador del RUT, pero no el de un pasaporte', () =>
    enTransaccion(async (c) => {
      await rechaza(c, persona, ['RUT', '12345678-9', null], 'persona_rut_valido');
      await acepta(c, persona, ['RUT', '12345678-5', null]);
      await acepta(c, persona, ['PAS', 'X1234567', null]);
    }));

  it('no repite documento ni correo (sin distinguir mayúsculas)', () =>
    enTransaccion(async (c) => {
      await acepta(c, persona, ['PAS', 'AB123456', 'ana@itn.cl']);
      await rechaza(c, persona, ['PAS', 'AB123456', null], 'persona_tipo_documento_numero_documento_key');
      await rechaza(c, persona, ['PAS', 'CD999999', 'ANA@ITN.CL'], 'persona_email_key');
    }));

  it('una persona tiene como máximo una cuenta', () =>
    enTransaccion(async (c) => {
      const m = await mundo(c);
      await rechaza(c, 'INSERT INTO seguridad.usuario (persona_id) VALUES ($1)', [m.docente.persona], 'usuario_persona_id_key');
    }));

  it('no duplica un rol con el mismo ámbito, aunque el ámbito tenga nulos', () =>
    enTransaccion(async (c) => {
      const m = await mundo(c);
      const rol = await uno(c, `SELECT id FROM seguridad.rol WHERE codigo = 'DOCENTE'`);
      const sql = 'INSERT INTO seguridad.usuario_rol (usuario_id, rol_id, sede_id, carrera_id) VALUES ($1, $2, $3, $4)';
      await acepta(c, sql, [m.docente.id, rol, null, null]);
      await rechaza(c, sql, [m.docente.id, rol, null, null], 'usuario_rol_usuario_id_rol_id_sede_id_carrera_id_key');
      await acepta(c, sql, [m.docente.id, rol, null, m.carrera]); // otro ámbito: válido
    }));
});

describe('institucion', () => {
  it('admite una sola institución', () =>
    enTransaccion(async (c) => {
      await rechaza(c, `INSERT INTO institucion.institucion (nombre) VALUES ('Otra')`, [], 'institucion_unica_key');
    }));

  it('valida el valor de un parámetro según su tipo', () =>
    enTransaccion(async (c) => {
      await rechaza(c, `INSERT INTO institucion.parametro VALUES ('prueba.minutos', 'quince', 'ENTERO', 'x')`, [], 'parametro_valor_segun_tipo');
      await acepta(c, `INSERT INTO institucion.parametro VALUES ('prueba.minutos', '15', 'ENTERO', 'x')`);
    }));

  it('los bloques horarios no se solapan; los contiguos sí se aceptan', () =>
    enTransaccion(async (c) => {
      const sql = `INSERT INTO institucion.bloque_horario (codigo, jornada, hora_inicio, hora_fin, orden) VALUES ($1, 'DIURNA', $2, $3, $4)`;
      await acepta(c, sql, ['P1', '08:30', '09:15', 901]);
      await acepta(c, sql, ['P2', '09:15', '10:00', 902]);
      await rechaza(c, sql, ['P3', '09:00', '09:45', 903], 'bloque_sin_solape');
    }));

  it('el código de un espacio es único dentro de su edificio', () =>
    enTransaccion(async (c) => {
      const m = await mundo(c);
      const sql = `INSERT INTO institucion.espacio (edificio_id, tipo_espacio_id, codigo, nombre, capacidad) VALUES ($1, $2, $3, 'x', $4)`;
      await rechaza(c, sql, [m.edificio, m.tipoSala, 'A-101', 30], 'espacio_edificio_id_codigo_key');
      await rechaza(c, sql, [m.edificio, m.tipoSala, 'A-200', 0], 'espacio_capacidad_check');
      const otro = await uno(c, `INSERT INTO institucion.edificio (sede_id, codigo, nombre) VALUES ($1, 'B', 'B') RETURNING id`, [m.sede]);
      await acepta(c, sql, [otro, m.tipoSala, 'A-101', 30]);
    }));

  it('un día no hábil "para ambas sedes" no se repite', () =>
    enTransaccion(async (c) => {
      const sql = `INSERT INTO institucion.dia_no_habil (fecha, sede_id, tipo, motivo) VALUES ('2027-05-21', NULL, 'FERIADO', 'Glorias Navales')`;
      await acepta(c, sql);
      await rechaza(c, sql, [], 'dia_no_habil_fecha_sede_id_key');
    }));
});

describe('academico', () => {
  it('los períodos académicos no se solapan', () =>
    enTransaccion(async (c) => {
      const sql = `INSERT INTO academico.periodo_academico (codigo, nombre, fecha_inicio, fecha_fin) VALUES ($1, $1, $2, $3)`;
      await acepta(c, sql, ['2091-1', '2091-03-01', '2091-07-15']);
      await rechaza(c, sql, ['2091-2', '2091-07-10', '2091-12-15'], 'periodo_sin_solape');
      await acepta(c, sql, ['2091-2', '2091-08-01', '2091-12-15']);
    }));

  it('una persona se matricula una vez por oferta y período', () =>
    enTransaccion(async (c) => {
      const m = await mundo(c);
      const periodo = await uno(c, `INSERT INTO academico.periodo_academico (codigo, nombre, fecha_inicio, fecha_fin) VALUES ('2092-1', 'x', '2092-03-01', '2092-07-15') RETURNING id`);
      const sql = 'INSERT INTO academico.matricula (persona_id, oferta_carrera_id, periodo_id) VALUES ($1, $2, $3)';
      await acepta(c, sql, [m.docente.persona, m.oferta, periodo]);
      await rechaza(c, sql, [m.docente.persona, m.oferta, periodo], 'matricula_persona_id_oferta_carrera_id_periodo_id_key');
    }));
});

describe('semillas', () => {
  it('se pueden ejecutar de nuevo sin duplicar datos', () =>
    enTransaccion(async (c) => {
      const antes = await uno<string>(c, 'SELECT count(*) FROM seguridad.rol_permiso');
      const { readFileSync } = await import('node:fs');
      await c.query(readFileSync(new URL('../semillas/S001__catalogos.sql', import.meta.url), 'utf8'));
      expect(await uno<string>(c, 'SELECT count(*) FROM seguridad.rol_permiso')).toBe(antes);
    }));
});
