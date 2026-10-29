import { Body, Controller, Get, Module, Post, Query, UnauthorizedException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { z } from 'zod';
import { usuarioCreateSchema, type Rol, type UsuarioCreate } from '@reservaitn/shared';
import { PrismaService } from '../comun/prisma.service';
import { AuthGuard, Publico, RequierePermiso, type UsuarioSesion } from '../comun/auth.guard';
import { ZodPipe } from '../comun/zod.pipe';

const loginSchema = z.object({ email: z.string().email().toLowerCase(), password: z.string().min(1) });
const nuevoUsuarioSchema = usuarioCreateSchema.extend({ password: z.string().min(8, 'Mínimo 8 caracteres') });
const SIN_HASH = { id: true, rut: true, email: true, nombre: true, rol: true, activo: true, carreraId: true } as const;

/** Usuarios, roles y acceso (E4 / WBS 1.4.1). */
@Controller()
class UsuariosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  @Publico()
  @Post('auth/login')
  async login(@Body(new ZodPipe(loginSchema)) dto: z.infer<typeof loginSchema>) {
    const u = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
    if (!u || !u.activo || !(await bcrypt.compare(dto.password, u.passwordHash))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const sesion: UsuarioSesion = { id: u.id, rol: u.rol, carreraId: u.carreraId, nombre: u.nombre };
    return { token: this.jwt.sign(sesion), usuario: sesion };
  }

  @RequierePermiso('usuario:gestionar')
  @Get('usuarios')
  listar(@Query('rol') rol?: Rol) {
    return this.prisma.usuario.findMany({ where: { rol }, select: SIN_HASH, orderBy: { nombre: 'asc' } });
  }

  @RequierePermiso('usuario:gestionar')
  @Post('usuarios')
  async crear(@Body(new ZodPipe(nuevoUsuarioSchema)) dto: UsuarioCreate & { password: string }) {
    const { password, ...datos } = dto;
    return this.prisma.usuario.create({
      data: { ...datos, passwordHash: await bcrypt.hash(password, 10) },
      select: SIN_HASH,
    });
  }
}

@Module({
  controllers: [UsuariosController],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class UsuariosModule {}
