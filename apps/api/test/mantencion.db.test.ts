import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { MantencionController } from '../src/mantencion/mantencion.module';
import { ReservasService } from '../src/reservas/reservas.service';
import { NotificacionesService } from '../src/notificaciones/notificaciones.module';
import { esChoqueBD } from '../src/comun/filtro-errores';
import type { UsuarioSesion } from '../src/comun/auth.guard';
import { a, espacio, lunesAlAzar, prisma, sesion } from './ayuda';

/** Mantención (R15, R17): daños → orden de trabajo con bloqueo de la sala → resolución. */
const notif = new NotificacionesService();
const mantencion = new MantencionController(prisma, notif);
const reservas = new ReservasService(prisma, notif);
const lunes = lunesAlAzar();
let aseo: UsuarioSesion, ops: UsuarioSesion, docente: UsuarioSesion;

beforeAll(async () => {
  [aseo, ops, docente] = await Promise.all(['aseo', 'operaciones', 'docente'].map((x) => sesion(`${x}@itn.cl`)));
});
afterAll(() => prisma.$disconnect());

describe('flujo de mantención', () => {
  it('la orden bloquea la sala, se asigna con aviso y al resolverla antes la sala se libera', async () => {
    const sala = await espacio('A-201');
    const r1 = await mantencion.reportar({ espacioId: sala.id, descripcion: 'Proyector no enciende', severidad: 'ALTA' }, aseo);
    const r2 = await mantencion.reportar({ espacioId: sala.id, descripcion: 'Cable HDMI cortado', severidad: 'MEDIA' }, aseo);
    // Operaciones recibe el aviso del daño
    expect(await prisma.notificacion.count({ where: { usuario_id: ops.id, evento_codigo: 'DANIO_REPORTADO', cuerpo: 'Proyector no enciende' } })).toBeGreaterThan(0);

    const inicio = a(lunes, 1, '08:00');
    const fin = a(lunes, 1, '12:00');
    const orden = await mantencion.crearOrden(
      { espacioId: sala.id, tipo: 'CORRECTIVA', prioridad: 'ALTA', reporteIds: [r1.id, r2.id], bloqueo: { inicio, fin } },
      ops,
    );
    expect(await prisma.reporte_danio.count({ where: { orden_trabajo_id: orden.id } })).toBe(2);

    // Mientras está bloqueada, nadie puede reservar ese horario
    const pedir = () => reservas.solicitar({ espacioId: sala.id, inicio: a(lunes, 1, '10:00'), fin: a(lunes, 1, '11:00'), tipoActividad: 'CLASE', descripcion: 'Clase', asistentes: 10 }, docente);
    expect(esChoqueBD(await pedir().catch((e) => e))).toBe(true);

    await mantencion.actualizarOrden(orden.id, { estado: 'ASIGNADA', asignadaA: aseo.id }, ops);
    expect(await prisma.notificacion.count({ where: { orden_trabajo_id: orden.id, usuario_id: aseo.id, evento_codigo: 'ORDEN_ASIGNADA' } })).toBe(1);

    await expect(mantencion.actualizarOrden(orden.id, { estado: 'RESUELTA' }, ops)).rejects.toThrow(/solución/);
    const resuelta = await mantencion.actualizarOrden(orden.id, { estado: 'RESUELTA', solucion: 'Se cambió el cable y se reinició el proyector' }, ops);
    expect(resuelta.estado).toBe('RESUELTA');

    // El bloqueo se canceló con su motivo y la sala quedó disponible
    const bloqueo = await prisma.reserva.findFirstOrThrow({ where: { solicitud_id: orden.solicitud_bloqueo_id! }, include: { cancelacion: true } });
    expect(bloqueo.estado).toBe('CANCELADA');
    expect(bloqueo.cancelacion?.motivo).toMatch(/resuelta/);
    expect((await pedir()).reserva[0].estado).toBe('PENDIENTE');
  });

  it('una orden cerrada no se reabre', async () => {
    const sala = await espacio('A-102');
    const orden = await mantencion.crearOrden({ espacioId: sala.id, tipo: 'PREVENTIVA', prioridad: 'MEDIA', reporteIds: [] }, ops);
    await mantencion.actualizarOrden(orden.id, { estado: 'CANCELADA' }, ops);
    await expect(mantencion.actualizarOrden(orden.id, { estado: 'ASIGNADA', asignadaA: aseo.id }, ops)).rejects.toBeInstanceOf(ConflictException);
  });
});
