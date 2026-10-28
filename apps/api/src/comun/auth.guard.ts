import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { tienePermiso, type Permiso, type Rol } from '@reservaitn/shared';

export interface UsuarioSesion {
  id: string;
  rol: Rol;
  carreraId: string | null;
  nombre: string;
}

const PUBLICO = 'publico';
const PERMISO = 'permiso';
export const Publico = () => SetMetadata(PUBLICO, true);
export const RequierePermiso = (p: Permiso) => SetMetadata(PERMISO, p);

export const UsuarioActual = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UsuarioSesion => ctx.switchToHttp().getRequest().usuario,
);

/** Guard global: valida el JWT y el permiso declarado con @RequierePermiso (E4). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLICO, targets)) return true;

    const req = ctx.switchToHttp().getRequest();
    const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1];
    if (!token) throw new UnauthorizedException('Falta el token de sesión');
    try {
      req.usuario = this.jwt.verify<UsuarioSesion>(token);
    } catch {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }

    const permiso = this.reflector.getAllAndOverride<Permiso>(PERMISO, targets);
    if (permiso && !tienePermiso(req.usuario.rol, permiso)) {
      throw new ForbiddenException('Su rol no tiene permiso para esta acción');
    }
    return true;
  }
}
