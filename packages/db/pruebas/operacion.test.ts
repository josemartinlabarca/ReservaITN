import { afterAll, describe, expect, it } from 'vitest';
import { acepta, cerrar, enTransaccion, mundo, rechaza, uno } from './ayuda';

afterAll(cerrar);

describe('mantencion', () => {
  it('un reporte solo se asocia a una orden de su misma sala (N3)', () =>
    enTransaccion(async (c) => {
      const m = await mundo(c);
      const orden = await uno(c, `INSERT INTO mantencion.orden_trabajo (espacio_id, tipo) VALUES ($1, 'CORRECTIVA') RETURNING id`, [m.sala]);
      const sql = `INSERT INTO mantencion.reporte_danio (espacio_id, reportado_por_usuario_id, descripcion, severidad, orden_trabajo_id)
                   VALUES ($1, $2, 'Silla rota', 'MEDIA', $3)`;
      await rechaza(c, sql, [m.lab, m.docente.id, orden], 'reporte_misma_sala_que_orden');
      await acepta(c, sql, [m.sala, m.docente.id, orden]);
    }));

  it('una orden asignada tiene responsable y una resuelta tiene fecha y solución', () =>
    enTransaccion(async (c) => {
      const m = await mundo(c);
      const orden = await uno(c, `INSERT INTO mantencion.orden_trabajo (espacio_id, tipo) VALUES ($1, 'CORRECTIVA') RETURNING id`, [m.sala]);
      await rechaza(c, `UPDATE mantencion.orden_trabajo SET estado = 'ASIGNADA' WHERE id = $1`, [orden], 'orden_asignada_con_responsable');
      await acepta(c, `UPDATE mantencion.orden_trabajo SET estado = 'ASIGNADA', asignada_a_usuario_id = $2 WHERE id = $1`, [orden, m.docente.id]);
      await rechaza(c, `UPDATE mantencion.orden_trabajo SET estado = 'RESUELTA' WHERE id = $1`, [orden], 'orden_resuelta_con_fecha');
      await rechaza(c, `UPDATE mantencion.orden_trabajo SET estado = 'RESUELTA', resuelta_en = now() WHERE id = $1`, [orden], 'orden_resuelta_con_solucion');
      await acepta(c, `UPDATE mantencion.orden_trabajo SET estado = 'RESUELTA', resuelta_en = now(), solucion = 'Se cambió la silla' WHERE id = $1`, [orden]);
    }));

  it('la vista muestra solo las diferencias de inventario', () =>
    enTransaccion(async (c) => {
      const m = await mundo(c);
      const insp = await uno(c, 'INSERT INTO mantencion.inspeccion (espacio_id, usuario_id) VALUES ($1, $2) RETURNING id', [m.sala, m.docente.id]);
      await c.query(`INSERT INTO mantencion.inspeccion_detalle (inspeccion_id, item_id, cantidad_contada, cantidad_esperada)
                     SELECT $1, id, CASE codigo WHEN 'SILLA' THEN 28 ELSE 1 END, CASE codigo WHEN 'SILLA' THEN 30 ELSE 1 END
                       FROM institucion.item WHERE codigo IN ('SILLA', 'PROYECTOR')`, [insp]);
      const { rows } = await c.query('SELECT diferencia FROM mantencion.v_diferencia_inventario WHERE inspeccion_id = $1', [insp]);
      expect(rows).toEqual([{ diferencia: -2 }]);
    }));
});

describe('comunicacion', () => {
  it('un aviso obligatorio no se puede desactivar', () =>
    enTransaccion(async (c) => {
      const m = await mundo(c);
      const sql = 'INSERT INTO comunicacion.preferencia VALUES ($1, $2, $3, false)';
      await rechaza(c, sql, [m.docente.id, 'RESERVA_CANCELADA', 'CORREO'], 'es obligatorio');
      await acepta(c, sql, [m.docente.id, 'SOLICITUD_APROBADA', 'CORREO']);
    }));

  it('una notificación apunta como máximo a un objeto', () =>
    enTransaccion(async (c) => {
      const m = await mundo(c);
      const s = await uno(c, `INSERT INTO reservas.solicitud (solicitante_usuario_id, tipo_actividad_id, descripcion, asistentes) VALUES ($1, $2, 'x x x', 1) RETURNING id`, [m.docente.id, m.clase]);
      const orden = await uno(c, `INSERT INTO mantencion.orden_trabajo (espacio_id, tipo) VALUES ($1, 'CORRECTIVA') RETURNING id`, [m.sala]);
      await rechaza(c, `INSERT INTO comunicacion.notificacion (usuario_id, evento_codigo, titulo, cuerpo, solicitud_id, orden_trabajo_id)
                        VALUES ($1, 'SOLICITUD_CREADA', 't', 'c', $2, $3)`, [m.docente.id, s, orden], 'notificacion_una_referencia');
    }));

  it('la cola de envíos no admite el canal APP y un envío exitoso tiene fecha', () =>
    enTransaccion(async (c) => {
      const m = await mundo(c);
      const n = await uno(c, `INSERT INTO comunicacion.notificacion (usuario_id, evento_codigo, titulo, cuerpo) VALUES ($1, 'SOLICITUD_APROBADA', 't', 'c') RETURNING id`, [m.docente.id]);
      await rechaza(c, `INSERT INTO comunicacion.envio (notificacion_id, canal) VALUES ($1, 'APP')`, [n], 'envio_canal_check');
      await rechaza(c, `INSERT INTO comunicacion.envio (notificacion_id, canal, estado) VALUES ($1, 'CORREO', 'ENVIADO')`, [n], 'envio_enviado_con_fecha');
      await acepta(c, `INSERT INTO comunicacion.envio (notificacion_id, canal) VALUES ($1, 'CORREO')`, [n]);
    }));
});

describe('auditoria', () => {
  it('registra cada cambio con su actor y oculta los datos sensibles (N6)', () =>
    enTransaccion(async (c) => {
      const m = await mundo(c);
      await c.query(`SELECT set_config('app.usuario_id', $1, true)`, [m.director.id]);
      await c.query(`UPDATE seguridad.usuario SET password_hash = 'nuevo-hash' WHERE id = $1`, [m.docente.id]);
      const e = (await c.query(`SELECT operacion::text, actor_usuario_id, datos_antes, datos_despues FROM auditoria.evento
                                 WHERE tabla = 'usuario' AND registro_id = $1 ORDER BY id DESC LIMIT 1`, [m.docente.id])).rows[0];
      expect(e.operacion).toBe('UPDATE');
      expect(e.actor_usuario_id).toBe(m.director.id);
      expect(e.datos_antes.password_hash).toBe('[oculto]');
      expect(JSON.stringify(e)).not.toContain('hash-secreto');
      expect(JSON.stringify(e)).not.toContain('nuevo-hash');
    }));

  it('la bitácora no se puede modificar, borrar ni vaciar', () =>
    enTransaccion(async (c) => {
      await mundo(c);
      await rechaza(c, 'UPDATE auditoria.evento SET tabla = $1', ['x'], 'solo inserción');
      await rechaza(c, 'DELETE FROM auditoria.evento', [], 'solo inserción');
      await rechaza(c, 'TRUNCATE auditoria.evento', [], 'solo inserción');
    }));

  it('actualiza actualizado_en en cada modificación', () =>
    enTransaccion(async (c) => {
      const m = await mundo(c);
      await c.query(`UPDATE academico.carrera SET actualizado_en = '2000-01-01' WHERE id = $1`, [m.carrera]);
      await c.query(`UPDATE academico.carrera SET nombre = 'Informática (nueva malla)' WHERE id = $1`, [m.carrera]);
      const fecha = await uno<Date>(c, 'SELECT actualizado_en FROM academico.carrera WHERE id = $1', [m.carrera]);
      expect(fecha.getFullYear()).toBeGreaterThan(2000);
    }));
});
