import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsuariosController } from '../src/usuarios/usuarios.module';
import { ReservasService } from '../src/reservas/reservas.service';
import { NotificacionesController, NotificacionesService } from '../src/notificaciones/notificaciones.module';
import type { UsuarioSesion } from '../src/comun/auth.guard';
import { a, lunesAlAzar, prisma, sesion } from './ayuda';

/** Lo que agregó la web con el diseño ITN: mi cuenta, bandeja de avisos e historial legible (R6, R7). */
const usuarios = new UsuariosController(prisma, new JwtService({ secret: 'prueba' }));
const reservas = new ReservasService(prisma, new NotificacionesService());
const avisos = new NotificacionesController(prisma);
let sub: UsuarioSesion, datd: UsuarioSesion, docente: UsuarioSesion;
const t = Date.now() % 1_000_000;

beforeAll(async () => {
  [sub, datd, docente] = await Promise.all(['subdireccion', 'datd', 'docente'].map((x) => sesion(`${x}@itn.cl`)));
});
afterAll(() => prisma.$disconnect());

describe('mi cuenta', () => {
  it('cambia la contraseña solo con la actual correcta, y la nueva sirve para ingresar', async () => {
    const email = `clave.${t}@itn.cl`;
    await usuarios.crear(
      { tipoDocumento: 'PAS', numeroDocumento: `C${t}`, nombres: 'Cambio', apellidoPaterno: 'Clave', email, password: 'clave-inicial', roles: [{ rol: 'DOCENTE' }] },
      datd,
    );
    const yo = await sesion(email);
    await expect(usuarios.cambiarClave({ actual: 'no-es', nueva: 'clave-nueva-1' }, yo)).rejects.toBeInstanceOf(BadRequestException);
    await usuarios.cambiarClave({ actual: 'clave-inicial', nueva: 'clave-nueva-1' }, yo);
    await expect(usuarios.login({ email, password: 'clave-inicial' })).rejects.toThrow();
    expect((await usuarios.login({ email, password: 'clave-nueva-1' })).usuario.id).toBe(yo.id);
  });
});

describe('historial legible y avisos', () => {
  it('la línea de tiempo muestra quién solicitó y quién canceló con su motivo; marcar todo deja 0 sin leer', async () => {
    const espacio = await prisma.espacio.findFirstOrThrow({ where: { codigo: 'A-101' } });
    const lunes = lunesAlAzar();
    const s = await reservas.solicitar(
      { espacioId: espacio.id, inicio: a(lunes, 1, '15:00'), fin: a(lunes, 1, '16:00'), tipoActividad: 'CLASE', descripcion: 'Ayudantía', asistentes: 8 },
      docente,
    );
    const id = s.reserva[0].id;
    await reservas.cancelar(id, sub, 'Evento de la subdirección');
    const { linea } = await reservas.historial(id);
    expect(linea.map((p) => p.accion)).toContain('CREADA');
    expect(linea.at(-1)).toMatchObject({ accion: 'CANCELADA', actor: 'Pedro Fernández', comentario: 'Evento de la subdirección' });

    await avisos.todasLeidas(docente);
    expect((await avisos.noLeidas(docente)).total).toBe(0);
  });
});
