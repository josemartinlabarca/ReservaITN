import { afterAll, describe, expect, it } from 'vitest';
import { acepta, cerrar, enTransaccion, mundo, rechaza, reserva, solicitud, uno } from './ayuda';

afterAll(cerrar);

const D = '2091-03-05'; // fecha futura de prueba
const t = (h: string) => `${D}T${h}:00-03:00`;

describe('anti-choques (R1)', () => {
  it('una solicitud pendiente bloquea el horario (D12); los horarios contiguos se aceptan', () =>
    enTransaccion(async (c) => {
      const m = await mundo(c);
      const s1 = await solicitud(c, m);
      const s2 = await solicitud(c, m);
      await reserva(c, s1, m.sala, t('10:00'), t('12:00'));
      await rechaza(c, `INSERT INTO reservas.reserva (solicitud_id, espacio_id, inicio, fin, estado, expira_en)
                        VALUES ($1, $2, $3, $4, 'PENDIENTE', now() + interval '1 day')`,
        [s2, m.sala, t('11:00'), t('13:00')], 'reserva_sin_choque');
      await reserva(c, s2, m.sala, t('12:00'), t('13:00')); // contigua
      await reserva(c, s2, m.lab, t('11:00'), t('13:00')); // otro espacio
    }));

  it('una reserva cancelada o rechazada no bloquea', () =>
    enTransaccion(async (c) => {
      const m = await mundo(c);
      const s1 = await solicitud(c, m);
      await reserva(c, s1, m.sala, t('10:00'), t('12:00'), 'CANCELADA');
      await reserva(c, s1, m.sala, t('10:00'), t('12:00'), 'RECHAZADA');
      await reserva(c, await solicitud(c, m), m.sala, t('10:00'), t('12:00'), 'APROBADA');
    }));

  it('al vencer el plazo, la pendiente expira y libera el horario', () =>
    enTransaccion(async (c) => {
      const m = await mundo(c);
      const s1 = await solicitud(c, m);
      await acepta(c, `INSERT INTO reservas.reserva (solicitud_id, espacio_id, inicio, fin, estado, expira_en)
                       VALUES ($1, $2, $3, $4, 'PENDIENTE', now() - interval '1 minute')`, [s1, m.sala, t('10:00'), t('12:00')]);
      expect(await uno<number>(c, 'SELECT reservas.expirar_pendientes($1)', [m.sala])).toBe(1);
      await reserva(c, await solicitud(c, m), m.sala, t('10:00'), t('12:00'));
    }));

  it('una pendiente siempre tiene plazo', () =>
    enTransaccion(async (c) => {
      const m = await mundo(c);
      await rechaza(c, `INSERT INTO reservas.reserva (solicitud_id, espacio_id, inicio, fin) VALUES ($1, $2, $3, $4)`,
        [await solicitud(c, m), m.sala, t('10:00'), t('11:00')], 'reserva_pendiente_con_plazo');
    }));

  it('criterio E6: 200 intentos aleatorios, ninguna reserva activa solapada', () =>
    enTransaccion(async (c) => {
      const m = await mundo(c);
      const s = await solicitud(c, m);
      let semilla = 11;
      const rnd = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
      let rechazadas = 0;
      for (let i = 0; i < 200; i++) {
        const ini = 8 * 60 + Math.floor(rnd() * 28) * 30;
        const dur = 30 * (1 + Math.floor(rnd() * 4));
        const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
        await c.query('SAVEPOINT intento');
        try {
          await reserva(c, s, m.sala, t(hhmm(ini)), t(hhmm(ini + dur)), rnd() < 0.5 ? 'PENDIENTE' : 'APROBADA');
          await c.query('RELEASE SAVEPOINT intento');
        } catch {
          await c.query('ROLLBACK TO SAVEPOINT intento');
          rechazadas++;
        }
      }
      expect(rechazadas).toBeGreaterThan(0);
      const solapes = await uno<string>(c, `
        SELECT count(*) FROM reservas.reserva a JOIN reservas.reserva b
          ON a.espacio_id = b.espacio_id AND a.id < b.id
         AND a.estado IN ('PENDIENTE','APROBADA') AND b.estado IN ('PENDIENTE','APROBADA')
         AND tstzrange(a.inicio, a.fin, '[)') && tstzrange(b.inicio, b.fin, '[)')
         WHERE a.espacio_id = $1`, [m.sala]);
      expect(Number(solapes)).toBe(0);
    }));
});

describe('solicitudes y recurrencia', () => {
  it('el patrón de una serie no se solapa consigo mismo en el mismo día', () =>
    enTransaccion(async (c) => {
      const m = await mundo(c);
      const s = await solicitud(c, m);
      const sql = 'INSERT INTO reservas.patron_recurrencia VALUES ($1, $2, $3, $4)';
      await acepta(c, sql, [s, 1, '08:00', '10:00']);
      await acepta(c, sql, [s, 3, '08:00', '10:00']); // lunes y miércoles
      await rechaza(c, sql, [s, 1, '09:00', '11:00'], 'patron_sin_solape');
    }));

  it('solo la planificación importada tiene origen PLANIFICACION', () =>
    enTransaccion(async (c) => {
      const m = await mundo(c);
      await rechaza(c, `INSERT INTO reservas.solicitud (solicitante_usuario_id, tipo_actividad_id, descripcion, asistentes, origen)
                        VALUES ($1, $2, 'Clase', 10, 'PLANIFICACION')`, [m.docente.id, m.clase], 'solicitud_planificacion_importada');
    }));

  it('la vista de importación calcula las filas correctas (N1, criterio E5)', () =>
    enTransaccion(async (c) => {
      const m = await mundo(c);
      const periodo = await uno(c, `INSERT INTO academico.periodo_academico (codigo, nombre, fecha_inicio, fecha_fin) VALUES ('2093-1', 'x', '2093-03-01', '2093-07-15') RETURNING id`);
      const imp = await uno(c, `INSERT INTO reservas.importacion (archivo_nombre, periodo_id, usuario_id, total_filas) VALUES ('plan.xlsx', $1, $2, 100) RETURNING id`, [periodo, m.docente.id]);
      await c.query(`INSERT INTO reservas.importacion_error (importacion_id, fila, columna, mensaje) VALUES
        ($1, 4, 'hora_inicio', 'Formato'), ($1, 4, 'inscritos', 'Número'), ($1, 9, NULL, 'Choque')`, [imp]);
      const r = (await c.query('SELECT filas_ok, proporcion_ok FROM reservas.v_importacion_resumen WHERE id = $1', [imp])).rows[0];
      expect(r).toEqual({ filas_ok: 98, proporcion_ok: '0.9800' });
      await rechaza(c, `INSERT INTO reservas.importacion_error (importacion_id, fila, columna, mensaje) VALUES ($1, 9, NULL, 'otra vez')`,
        [imp], 'importacion_error_importacion_id_fila_columna_key');
    }));
});

describe('aprobación (D11, N4)', () => {
  it('aprobar una serie aprueba todas sus reservas pendientes', () =>
    enTransaccion(async (c) => {
      const m = await mundo(c);
      const s = await solicitud(c, m);
      for (const dia of ['2091-03-05', '2091-03-12', '2091-03-19'])
        await reserva(c, s, m.sala, `${dia}T08:00:00-03:00`, `${dia}T10:00:00-03:00`);
      await acepta(c, `INSERT INTO reservas.aprobacion (solicitud_id, decision, decidido_por_usuario_id) VALUES ($1, 'APROBADA', $2)`, [s, m.director.id]);
      expect(await uno(c, `SELECT string_agg(DISTINCT estado::text, ',') FROM reservas.reserva WHERE solicitud_id = $1`, [s])).toBe('APROBADA');
    }));

  it('la decisión es definitiva', () =>
    enTransaccion(async (c) => {
      const m = await mundo(c);
      const s = await solicitud(c, m);
      await reserva(c, s, m.sala, t('08:00'), t('09:00'));
      await acepta(c, `INSERT INTO reservas.aprobacion (solicitud_id, decision) VALUES ($1, 'APROBADA')`, [s]); // automática
      await rechaza(c, `UPDATE reservas.aprobacion SET decision = 'RECHAZADA' WHERE solicitud_id = $1`, [s], 'solo inserción');
      await rechaza(c, `INSERT INTO reservas.aprobacion (solicitud_id, decision) VALUES ($1, 'APROBADA')`, [s], 'aprobacion_solicitud_id_key');
    }));

  it('un rechazo exige motivo y una persona responsable', () =>
    enTransaccion(async (c) => {
      const m = await mundo(c);
      const s = await solicitud(c, m);
      await reserva(c, s, m.sala, t('08:00'), t('09:00'));
      const sql = 'INSERT INTO reservas.aprobacion (solicitud_id, decision, decidido_por_usuario_id, comentario) VALUES ($1, $2, $3, $4)';
      await rechaza(c, sql, [s, 'RECHAZADA', m.director.id, null], 'aprobacion_rechazo_con_motivo');
      await rechaza(c, sql, [s, 'RECHAZADA', null, 'Sala ocupada'], 'aprobacion_automatica_solo_aprueba');
      await acepta(c, sql, [s, 'RECHAZADA', m.director.id, 'Sala ocupada']);
      expect(await uno(c, 'SELECT estado::text FROM reservas.reserva WHERE solicitud_id = $1', [s])).toBe('RECHAZADA');
    }));

  it('no se aprueba una solicitud que ya no tiene reservas pendientes', () =>
    enTransaccion(async (c) => {
      const m = await mundo(c);
      const s = await solicitud(c, m);
      await reserva(c, s, m.sala, t('08:00'), t('09:00'), 'CANCELADA');
      await rechaza(c, `INSERT INTO reservas.aprobacion (solicitud_id, decision) VALUES ($1, 'APROBADA')`, [s], 'no tiene reservas pendientes');
    }));

  it('las reglas de aprobación son coherentes y no se duplican', () =>
    enTransaccion(async (c) => {
      const rol = await uno(c, `SELECT id FROM seguridad.rol WHERE codigo = 'DOCENTE'`);
      await rechaza(c, `INSERT INTO reservas.regla_aprobacion (rol_solicitante_id, accion) VALUES ($1, 'REQUIERE_APROBACION')`,
        [rol], 'regla_aprobador_coherente');
      await rechaza(c, `INSERT INTO reservas.regla_aprobacion (accion, prioridad) VALUES ('AUTO_APROBAR', 5)`,
        [], 'regla_aprobacion_unica');
    }));
});

describe('estados y check-in', () => {
  it('solo se permiten las transiciones del diagrama de estados', () =>
    enTransaccion(async (c) => {
      const m = await mundo(c);
      const r = await reserva(c, await solicitud(c, m), m.sala, t('08:00'), t('09:00'), 'CANCELADA');
      await rechaza(c, `UPDATE reservas.reserva SET estado = 'APROBADA' WHERE id = $1`, [r], 'Transición de reserva no permitida');
    }));

  it('el check-in solo vale en una reserva aprobada y dentro de su horario', () =>
    enTransaccion(async (c) => {
      const m = await mundo(c);
      const s = await solicitud(c, m);
      const ahora = await uno<Date>(c, 'SELECT now()');
      const desplazar = (min: number) => new Date(ahora.getTime() + min * 60_000).toISOString();
      const pendiente = await reserva(c, s, m.lab, desplazar(-5), desplazar(55));
      const enCurso = await reserva(c, s, m.sala, desplazar(-5), desplazar(55), 'APROBADA');
      const futura = await reserva(c, s, m.sala, desplazar(180), desplazar(240), 'APROBADA');
      const sql = `INSERT INTO reservas.check_in (reserva_id, usuario_id, metodo) VALUES ($1, $2, 'QR')`;
      await rechaza(c, sql, [pendiente, m.docente.id], 'Solo se puede hacer check-in en una reserva aprobada');
      await rechaza(c, sql, [futura, m.docente.id], 'El check-in debe hacerse');
      await acepta(c, sql, [enCurso, m.docente.id]);
    }));
});
