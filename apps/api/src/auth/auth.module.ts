import { Body, Controller, Module, Post, UnauthorizedException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { z } from 'zod';
import { PrismaService } from '../comun/prisma.service';
import { AuthGuard, Publico, type UsuarioSesion } from '../comun/auth.guard';
import { ZodPipe } from '../comun/zod.pipe';

const loginSchema = z.object({ email: z.string().email().toLowerCase(), password: z.string().min(1) });

@Controller('auth')
class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  @Publico()
  @Post('login')
  async login(@Body(new ZodPipe(loginSchema)) dto: z.infer<typeof loginSchema>) {
    const u = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
    if (!u || !u.activo || !(await bcrypt.compare(dto.password, u.passwordHash))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const sesion: UsuarioSesion = { id: u.id, rol: u.rol, carreraId: u.carreraId, nombre: u.nombre };
    return { token: this.jwt.sign(sesion), usuario: sesion };
  }
}

@Module({
  controllers: [AuthController],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AuthModule {}
