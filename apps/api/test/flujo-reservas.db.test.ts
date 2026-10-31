import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { ReservasService } from '../src/reservas/reservas.service';
import { NotificacionesService } from '../src/notificaciones/notificaciones.module';
import { esChoqueBD } from '../src/comun/filtro-errores';
import type { UsuarioSesion } from '../src/comun/auth.guard';
import { a, espacio, lunesAlAzar, prisma, sesion } from './ayuda';

const svc = new ReservasService(prisma, new NotificacionesService());
const lunes = lunesAlAzar();
let u: Record<'docente' | 'estudiante' | 'dirInf' | 'dirEnf' | 'sub' | 'aseo', UsuarioSesion>;
let sala: string;

beforeAll(async () => {
  const [docente, estudiante, dirInf, dirEnf, sub, aseo] = await Promise.all(
    ['docente', 'estudiante', 'dir.inf', 'dir.enf', 'subdireccion', 'aseo'].map((x) => sesion(`${x}@itn.cl`)),
  );
  u = { docente, estudiante, dirInf, dirEnf, sub, aseo };
  sala = (await espacio('A-101')).id;
});
afterAll(() => prisma.$disconnect());

const pedir = (quien: UsuarioSesion, inicio: Date, fin: Date, extra: Partial<Parameters<ReservasService['solicitar']>[0]> = {}) =>
  svc.solicitar({ espacioId: sala, inicio, fin, tipoActividad: 'CLASE', descripcion: 'Clase de prueba', asistentes: 20, ...extra }, quien);

describe('flujo de una solicitud (R1, R4, R6, D11, D12)', () => {
  it('pendiente → bloquea el horario → la aprueba el director de la carrera del docente', async () => {
    const s = await pedir(u.docente, a(lunes, 0, '10:00'), a(lunes, 0, '11:30'));
    expect(s.reserva.map((r) => r.estado)).toEqual(['PENDIENTE']);
    expect(s.reserva[0].expira_en).not.toBeNull();

    // El director de Informática recibe el aviso; la de Enfermería no
    const aviso = await prisma.notificacion.findFirst({ where: { solicitud_id: s.id, evento_codigo: 'SOLICITUD_CREADA' } });
    expect(aviso?.usuario_id).toBe(u.dirInf.id);
    expect(await prisma.envio.count({ where: { notificacion_id: aviso!.id, canal: 'CORREO' } })).toBe(1);

    // D12: la pendiente bloquea; otra persona no puede pedir el mismo horario
    const otra = await pedir(u.estudiante, a(lunes, 0, '11:00'), a(lunes, 0, '12:00'), { tipoActividad: 'ESTUDIO', asistentes: 5 }).catch((e) => e);
    expect(esChoqueBD(otra)).toBe(true);

    expect((await svc.pendientes(u.dirInf)).map((p) => p.id)).toContain(s.id);
    expect((await svc.pendientes(u.dirEnf)).map((p) => p.id)).not.toContain(s.id);
    await expect(svc.decidir(s.id, 'APROBADA', u.dirEnf)).rejects.toBeInstanceOf(ForbiddenException);

    const aprobada = await svc.decidir(s.id, 'APROBADA', u.dirInf, 'Ok');
    expect(aprobada.reserva[0].estado).toBe('APROBADA');
    expect(aprobada.aprobacion?.decidido_por_usuario_id).toBe(u.dirInf.id);
    expect(await prisma.notificacion.count({ where: { solicitud_id: s.id, evento_codigo: 'SOLICITUD_APROBADA', usuario_id: u.docente.id } })).toBe(1);
  });

  it('Subdirección se autoaprueba y deja registro de la regla aplicada (N4)', async () => {
    const s = await pedir(u.sub, a(lunes, 1, '08:00'), a(lunes, 1, '09:00'), { tipoActividad: 'REUNION' });
    expect(s.reserva[0].estado).toBe('APROBADA');
    expect(s.aprobacion).toMatchObject({ decision: 'APROBADA', decidido_por_usuario_id: null });
  });

  it('el personal de aseo no puede reservar (regla PROHIBIDO)', async () => {
    await expect(pedir(u.aseo, a(lunes, 1, '15:00'), a(lunes, 1, '16:00'))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('un rechazo llega al solicitante con el motivo', async () => {
    const s = await pedir(u.docente, a(lunes, 1, '12:00'), a(lunes, 1, '13:00'));
    const r = await svc.decidir(s.id, 'RECHAZADA', u.dirInf, 'Sala en mantención');
    expect(r.reserva[0].estado).toBe('RECHAZADA');
    const n = await prisma.notificacion.findFirstOrThrow({ where: { solicitud_id: s.id, evento_codigo: 'SOLICITUD_RECHAZADA' } });
    expect(n.cuerpo).toContain('Sala en mantención');
  });
});

describe('series semanales (D13)', () => {
  it('genera una reserva por semana, omite el feriado y guarda el patrón en hora de Chile', async () => {
    const feriado = a(lunes, 14, '00:00');
    await prisma.dia_no_habil.create({
      data: { fecha: new Date(feriado.toLocaleDateString('sv-SE')), tipo: 'FERIADO', motivo: 'Feriado de prueba' },
    });
    const hasta = a(lunes, 21, '00:00');
    const s = await pedir(u.docente, a(lunes, 0, '14:00'), a(lunes, 0, '15:30'), {
      repetirHasta: new Date(hasta.toLocaleDateString('sv-SE')),
    });
    expect(s.reserva).toHaveLength(3); // 4 lunes, menos el feriado
    expect(s.reserva.every((r) => new Date(r.inicio).getHours() === 14)).toBe(true);
    const [patron] = await prisma.$queryRaw<{ dia_semana: number; hora_inicio: string }[]>`
      SELECT dia_semana, hora_inicio::text FROM reservas.patron_recurrencia WHERE solicitud_id = ${s.id}::uuid`;
    expect(patron).toEqual({ dia_semana: 1, hora_inicio: '14:00:00' });

    // Aprobar la serie aprueba todas sus fechas de una vez
    const aprobada = await svc.decidir(s.id, 'APROBADA', u.dirInf);
    expect(new Set(aprobada.reserva.map((r) => r.estado))).toEqual(new Set(['APROBADA']));
  });
});

describe('cancelación (R5) y auditoría (R7)', () => {
  it('un docente no cancela reservas ajenas; Subdirección sí, y se avisa al solicitante', async () => {
    const s = await pedir(u.estudiante, a(lunes, 2, '16:00'), a(lunes, 2, '17:00'), { tipoActividad: 'ESTUDIO', asistentes: 5 });
    const reservaId = s.reserva[0].id;
    await expect(svc.cancelar(reservaId, u.docente)).rejects.toBeInstanceOf(ForbiddenException);
    // Subdirección debe indicar el motivo
    await expect(svc.cancelar(reservaId, u.sub)).rejects.toThrow(/motivo/);
    const r = await svc.cancelar(reservaId, u.sub, 'Evento institucional');
    expect(r.estado).toBe('CANCELADA');
    const aviso = await prisma.notificacion.findFirstOrThrow({ where: { reserva_id: reservaId, evento_codigo: 'RESERVA_CANCELADA', usuario_id: u.estudiante.id } });
    expect(aviso.cuerpo).toContain('Evento institucional');
    expect(await prisma.cancelacion.findUnique({ where: { reserva_id: reservaId } })).toMatchObject({ usuario_id: u.sub.id, motivo: 'Evento institucional' });

    // Cada cambio queda en la bitácora con su actor
    const eventos = await prisma.evento.findMany({ where: { tabla: 'reserva', registro_id: reservaId }, orderBy: { id: 'asc' } });
    expect(eventos.map((e) => [e.operacion, e.actor_usuario_id])).toEqual([
      ['INSERT', u.estudiante.id],
      ['UPDATE', u.sub.id],
    ]);
  });
});

describe('concurrencia (E6)', () => {
  it('20 solicitudes simultáneas del mismo horario: exactamente una queda', async () => {
    const resultados = await Promise.allSettled(
      Array.from({ length: 20 }, () => pedir(u.docente, a(lunes, 3, '09:00'), a(lunes, 3, '10:00'))),
    );
    const ok = resultados.filter((r) => r.status === 'fulfilled');
    expect(ok).toHaveLength(1);
    expect(resultados.filter((r) => r.status === 'rejected').every((r) => esChoqueBD((r as PromiseRejectedResult).reason))).toBe(true);
  });
});
