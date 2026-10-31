import { Body, Controller, Get, Module, Post, UnauthorizedException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { z } from 'zod';
import { usuarioCreateSchema, type Rol, type RolAsignado, type UsuarioCreate } from '@reservaitn/shared';
import { PrismaService } from '../comun/prisma.service';
import { AuthGuard, Publico, RequierePermiso, UsuarioActual, type UsuarioSesion } from '../comun/auth.guard';
import { ZodPipe } from '../comun/zod.pipe';

const loginSchema = z.object({ email: z.string().email().toLowerCase(), password: z.string().min(1) });

/** Usuarios, roles y acceso (E4 / WBS 1.4.1). */
@Controller()
class UsuariosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Roles vigentes y permisos efectivos, calculados por la base (V010). */
  private async sesionDe(usuarioId: string, nombre: string): Promise<UsuarioSesion> {
    const roles = await this.prisma.$queryRaw<{ codigo: Rol; sede_id: string | null; carrera_id: string | null }[]>`
      SELECT codigo, sede_id, carrera_id FROM seguridad.roles_vigentes(${usuarioId}::uuid)`;
    const permisos = await this.prisma.$queryRaw<{ p: string }[]>`
      SELECT seguridad.permisos_de(${usuarioId}::uuid) AS p`;
    return {
      id: usuarioId,
      nombre,
      roles: roles.map((r): RolAsignado => ({ codigo: r.codigo, sedeId: r.sede_id, carreraId: r.carrera_id })),
      permisos: permisos.map((x) => x.p).sort(),
    };
  }

  @Publico()
  @Post('auth/login')
  async login(@Body(new ZodPipe(loginSchema)) dto: z.infer<typeof loginSchema>) {
    const persona = await this.prisma.persona.findUnique({ where: { email: dto.email }, include: { usuario: true } });
    const u = persona?.usuario;
    // Mismo mensaje en todos los casos: no revela si el correo existe
    if (!u || u.estado !== 'ACTIVO' || !u.password_hash || !(await bcrypt.compare(dto.password, u.password_hash))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    await this.prisma.usuario.update({ where: { id: u.id }, data: { ultimo_acceso: new Date() } });
    const sesion = await this.sesionDe(u.id, `${persona.nombres} ${persona.apellido_paterno}`);
    return { token: this.jwt.sign(sesion), usuario: sesion };
  }

  @Get('auth/yo')
  yo(@UsuarioActual() u: UsuarioSesion) {
    return u;
  }

  @RequierePermiso('usuario:gestionar')
  @Get('usuarios')
  async listar() {
    const usuarios = await this.prisma.usuario.findMany({
      select: {
        id: true,
        estado: true,
        ultimo_acceso: true,
        persona: { select: { nombres: true, apellido_paterno: true, email: true, tipo_documento: true, numero_documento: true } },
        usuario_rol: { select: { rol: { select: { codigo: true } }, sede_id: true, carrera_id: true } },
      },
      orderBy: { persona: { apellido_paterno: 'asc' } },
    });
    return usuarios;
  }

  /** Crea persona + cuenta + roles en una transacción (auditada). */
  @RequierePermiso('usuario:gestionar')
  @Post('usuarios')
  async crear(@Body(new ZodPipe(usuarioCreateSchema)) dto: UsuarioCreate, @UsuarioActual() actor: UsuarioSesion) {
    const hash = dto.password ? await bcrypt.hash(dto.password, 10) : null;
    return this.prisma.conActor(actor.id, async (tx) => {
      const persona = await tx.persona.create({
        data: {
          tipo_documento: dto.tipoDocumento,
          numero_documento: dto.numeroDocumento,
          nombres: dto.nombres,
          apellido_paterno: dto.apellidoPaterno,
          apellido_materno: dto.apellidoMaterno,
          email: dto.email,
        },
      });
      const usuario = await tx.usuario.create({ data: { persona_id: persona.id, password_hash: hash } });
      for (const r of dto.roles) {
        const rol = await tx.rol.findUniqueOrThrow({ where: { codigo: r.rol } });
        await tx.usuario_rol.create({
          data: { usuario_id: usuario.id, rol_id: rol.id, sede_id: r.sedeId ?? null, carrera_id: r.carreraId ?? null },
        });
      }
      return { id: usuario.id, personaId: persona.id };
    });
  }
}

@Module({
  controllers: [UsuariosController],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class UsuariosModule {}
