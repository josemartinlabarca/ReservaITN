import { afterAll, describe, expect, it } from 'vitest';
import { asignarRol, cerrar, enTransaccion, mundo, reserva, uno, usuarioCon } from './ayuda';

afterAll(cerrar);

const D = '2091-04-02';
const t = (h: string) => `${D}T${h}:00-03:00`;

/** Acción y rol aprobador de la regla que aplica. */
async function regla(c: Parameters<Parameters<typeof enTransaccion>[0]>[0], usuario: string, espacio: string, actividad: string) {
  const { rows } = await c.query(
    `SELECT r.accion::text, ra.codigo AS aprobador, r.ambito_aprobador::text AS ambito
       FROM reservas.regla_aplicable($1, $2, (SELECT id FROM reservas.tipo_actividad WHERE codigo = $3)) r
       LEFT JOIN seguridad.rol ra ON ra.id = r.rol_aprobador_id`, [usuario, espacio, actividad]);
  return rows[0];
}

describe('regla aplicable (D11)', () => {
  it('elige la regla de mayor prioridad según rol, tipo de espacio y actividad', () =>
    enTransaccion(async (c) => {
      const m = await mundo(c);
      await asignarRol(c, m.docente.id, 'DOCENTE', { carrera: m.carrera });
      expect(await regla(c, m.docente.id, m.sala, 'CLASE')).toEqual({ accion: 'REQUIERE_APROBACION', aprobador: 'DIRECTOR_CARRERA', ambito: 'CARRERA_SOLICITANTE' });
      expect(await regla(c, m.docente.id, m.lab, 'CLASE')).toEqual({ accion: 'REQUIERE_APROBACION', aprobador: 'DIRECTOR_CARRERA', ambito: 'CARRERA_ESPACIO' });

      const sub = await usuarioCon(c, [['SUBDIRECCION']]);
      expect((await regla(c, sub, m.sala, 'EVENTO')).accion).toBe('AUTO_APROBAR');
      const aseo = await usuarioCon(c, [['ASEO_MANTENCION']]);
      expect((await regla(c, aseo, m.sala, 'ESTUDIO')).accion).toBe('PROHIBIDO');
      const ops = await usuarioCon(c, [['OPERACIONES']]);
      expect((await regla(c, ops, m.sala, 'MANTENCION')).accion).toBe('AUTO_APROBAR');
      expect((await regla(c, ops, m.sala, 'REUNION')).aprobador).toBe('DIRECCION_ACADEMICA'); // regla por defecto
    }));
});

describe('quién aprueba', () => {
  it('el director de la carrera del solicitante aprueba; el de otra carrera no; Subdirección siempre', () =>
    enTransaccion(async (c) => {
      const m = await mundo(c);
      await asignarRol(c, m.docente.id, 'DOCENTE', { carrera: m.carrera });
      await asignarRol(c, m.director.id, 'DIRECTOR_CARRERA', { carrera: m.carrera });
      const otraCarrera = await uno(c, `INSERT INTO academico.carrera (codigo, nombre) VALUES ('ENF-X1', 'Enfermería') RETURNING id`);
      const directorOtra = await usuarioCon(c, [['DIRECTOR_CARRERA', { carrera: otraCarrera }]]);
      const sub = await usuarioCon(c, [['SUBDIRECCION']]);

      const s = await uno(c, `INSERT INTO reservas.solicitud (solicitante_usuario_id, tipo_actividad_id, descripcion, asistentes)
                              VALUES ($1, $2, 'Clase', 20) RETURNING id`, [m.docente.id, m.clase]);
      await reserva(c, s, m.sala, t('08:00'), t('10:00'));

      const puede = (u: string) => uno<boolean>(c, 'SELECT reservas.puede_aprobar($1, $2)', [u, s]);
      expect(await puede(m.director.id)).toBe(true);
      expect(await puede(directorOtra)).toBe(false);
      expect(await puede(sub)).toBe(true);
      expect(await puede(m.docente.id)).toBe(false);

      const { rows } = await c.query('SELECT reservas.aprobadores_de($1) AS id', [s]);
      expect(rows.map((r) => r.id)).toEqual([m.director.id]);
    }));

  it('en un laboratorio aprueba el director de la carrera a la que pertenece el espacio', () =>
    enTransaccion(async (c) => {
      const m = await mundo(c);
      const otraCarrera = await uno(c, `INSERT INTO academico.carrera (codigo, nombre) VALUES ('ENF-X2', 'Enfermería') RETURNING id`);
      await asignarRol(c, m.docente.id, 'DOCENTE', { carrera: otraCarrera }); // docente de otra carrera pide el lab
      await asignarRol(c, m.director.id, 'DIRECTOR_CARRERA', { carrera: m.carrera });
      await c.query(`INSERT INTO institucion.espacio_carrera VALUES ($1, $2, 'EXCLUSIVO')`, [m.lab, m.carrera]);
      const s = await uno(c, `INSERT INTO reservas.solicitud (solicitante_usuario_id, tipo_actividad_id, descripcion, asistentes)
                              VALUES ($1, $2, 'Préstamo de laboratorio', 15) RETURNING id`, [m.docente.id, m.clase]);
      await reserva(c, s, m.lab, t('08:00'), t('10:00'));
      expect(await uno<boolean>(c, 'SELECT reservas.puede_aprobar($1, $2)', [m.director.id, s])).toBe(true);
    }));
});

describe('liberación sin check-in (R18)', () => {
  it('libera la reserva aprobada sin check-in pasado el plazo, pero no la que tuvo check-in', () =>
    enTransaccion(async (c) => {
      const m = await mundo(c);
      const s = await uno(c, `INSERT INTO reservas.solicitud (solicitante_usuario_id, tipo_actividad_id, descripcion, asistentes)
                              VALUES ($1, $2, 'Estudio', 5) RETURNING id`, [m.docente.id, m.clase]);
      const sinCheckIn = await uno(c, `INSERT INTO reservas.reserva (solicitud_id, espacio_id, inicio, fin, estado)
                                       VALUES ($1, $2, now() - interval '20 minutes', now() + interval '40 minutes', 'APROBADA') RETURNING id`, [s, m.sala]);
      const conCheckIn = await uno(c, `INSERT INTO reservas.reserva (solicitud_id, espacio_id, inicio, fin, estado)
                                       VALUES ($1, $2, now() - interval '20 minutes', now() + interval '40 minutes', 'APROBADA') RETURNING id`, [s, m.lab]);
      await c.query(`INSERT INTO reservas.check_in (reserva_id, usuario_id, metodo) VALUES ($1, $2, 'QR')`, [conCheckIn, m.docente.id]);

      const { rows } = await c.query('SELECT * FROM reservas.liberar_sin_check_in()');
      expect(rows).toEqual([{ reserva_id: sinCheckIn, solicitante_usuario_id: m.docente.id }]);
      expect(await uno(c, 'SELECT estado::text FROM reservas.reserva WHERE id = $1', [sinCheckIn])).toBe('LIBERADA');
    }));
});
