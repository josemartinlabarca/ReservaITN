import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RecursosController } from '../src/recursos/recursos.module';
import { UsuariosController } from '../src/usuarios/usuarios.module';
import { ReservasService } from '../src/reservas/reservas.service';
import { NotificacionesService } from '../src/notificaciones/notificaciones.module';
import type { UsuarioSesion } from '../src/comun/auth.guard';
import { a, lunesAlAzar, prisma, sesion } from './ayuda';

/** Administración de espacios (1.4.2) y usuarios (1.4.1): reglas de integridad. */
const recursos = new RecursosController(prisma);
const usuarios = new UsuariosController(prisma, new JwtService({ secret: 'prueba' }));
const reservas = new ReservasService(prisma, new NotificacionesService());
let sub: UsuarioSesion, datd: UsuarioSesion, docente: UsuarioSesion;
const t = Date.now() % 1_000_000;

beforeAll(async () => {
  [sub, datd, docente] = await Promise.all(['subdireccion', 'datd', 'docente'].map((x) => sesion(`${x}@itn.cl`)));
});
afterAll(() => prisma.$disconnect());

async function espacioNuevo() {
  const [edificio, tipo, silla] = await Promise.all([
    prisma.edificio.findFirstOrThrow({ where: { codigo: 'A' } }),
    prisma.tipo_espacio.findUniqueOrThrow({ where: { codigo: 'SALA' } }),
    prisma.item.findUniqueOrThrow({ where: { codigo: 'SILLA' } }),
  ]);
  const e = await recursos.crear(
    { edificioId: edificio.id, tipoEspacioId: tipo.id, codigo: `ADM-${t}-${Math.floor(Math.random() * 1000)}`, nombre: 'Sala de prueba', piso: 3, capacidad: 30, accesible: false, items: [{ itemId: silla.id, cantidad: 30 }] },
    sub,
  );
  return { e, silla };
}

describe('administración de espacios', () => {
  it('edita capacidad y reemplaza el equipamiento completo', async () => {
    const { e } = await espacioNuevo();
    const proyector = await prisma.item.findUniqueOrThrow({ where: { codigo: 'PROYECTOR' } });
    const editado = await recursos.editar(e.id, { capacidad: 45, accesible: true, items: [{ itemId: proyector.id, cantidad: 1 }] }, sub);
    expect(editado).toMatchObject({ capacidad: 45, accesible: true });
    expect(editado.espacio_item.map((i) => [i.item.codigo, i.cantidad_esperada])).toEqual([['PROYECTOR', 1]]);
  });

  it('no deja desactivar un espacio con reservas futuras; sin ellas, sí', async () => {
    const { e } = await espacioNuevo();
    const lunes = lunesAlAzar();
    const s = await reservas.solicitar({ espacioId: e.id, inicio: a(lunes, 0, '10:00'), fin: a(lunes, 0, '11:00'), tipoActividad: 'CLASE', descripcion: 'Clase', asistentes: 10 }, docente);
    await expect(recursos.editar(e.id, { activo: false }, sub)).rejects.toBeInstanceOf(ConflictException);
    await reservas.cancelar(s.reserva[0].id, docente);
    expect((await recursos.editar(e.id, { activo: false }, sub)).activo).toBe(false);
    // Desactivado: no aparece en la lista normal, sí en la de administración
    expect((await recursos.espacios(sub)).some((x) => x.id === e.id)).toBe(false);
    expect((await recursos.espacios(sub, undefined, undefined, 'true')).some((x) => x.id === e.id)).toBe(true);
  });

  it('solo los administradores ven los espacios desactivados', async () => {
    expect(() => recursos.espacios(docente, undefined, undefined, 'true')).toThrow(ForbiddenException);
  });
});

describe('administración de usuarios', () => {
  async function usuarioNuevo() {
    const email = `nuevo${t}${Math.floor(Math.random() * 1000)}@itn.cl`;
    const r = await usuarios.crear(
      { tipoDocumento: 'PAS', numeroDocumento: `N${t}${Math.floor(Math.random() * 1000)}`, nombres: 'Nueva', apellidoPaterno: 'Docente', email, password: 'clave-inicial', roles: [{ rol: 'DOCENTE' }] },
      datd,
    );
    return { ...r, email };
  }

  it('cambia roles y contraseña; un usuario bloqueado no puede entrar', async () => {
    const u = await usuarioNuevo();
    expect((await usuarios.login({ email: u.email, password: 'clave-inicial' })).usuario.permisos).toEqual(['reserva:solicitar']);

    const carrera = await prisma.carrera.findUniqueOrThrow({ where: { codigo: 'INF' } });
    const editado = await usuarios.editar(u.id, { roles: [{ rol: 'DIRECTOR_CARRERA', carreraId: carrera.id }], password: 'clave-nueva-123' }, datd);
    expect(editado?.usuario_rol.map((r) => [r.rol.codigo, r.carrera_id])).toEqual([['DIRECTOR_CARRERA', carrera.id]]);
    await expect(usuarios.login({ email: u.email, password: 'clave-inicial' })).rejects.toBeInstanceOf(UnauthorizedException);
    expect((await usuarios.login({ email: u.email, password: 'clave-nueva-123' })).usuario.permisos).toContain('reserva:aprobar');

    await usuarios.editar(u.id, { estado: 'BLOQUEADO' }, datd);
    await expect(usuarios.login({ email: u.email, password: 'clave-nueva-123' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('un administrador no puede bloquearse ni quitarse el permiso de administrar usuarios', async () => {
    await expect(usuarios.editar(datd.id, { estado: 'BLOQUEADO' }, datd)).rejects.toBeInstanceOf(BadRequestException);
    await expect(usuarios.editar(datd.id, { roles: [{ rol: 'DOCENTE' }] }, datd)).rejects.toBeInstanceOf(BadRequestException);
    // Puede cambiar sus roles mientras conserve el permiso
    const r = await usuarios.editar(datd.id, { roles: [{ rol: 'DATD' }] }, datd);
    expect(r?.usuario_rol.map((x) => x.rol.codigo)).toEqual(['DATD']);
  });
});
