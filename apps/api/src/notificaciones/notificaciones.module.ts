import { Controller, Get, Global, Injectable, Module, Param, Patch } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../comun/prisma.service';
import { UsuarioActual, type UsuarioSesion } from '../comun/auth.guard';

/**
 * Notificaciones (R6 / E8 / WBS 1.4.6). Hoy registra en BD (bandeja in-app).
 * Siguiente paso: un worker que envíe correo (SMTP) y push (Expo) usando `enviadaEn`.
 */
@Injectable()
export class NotificacionesService {
  constructor(private readonly prisma: PrismaService) {}

  notificar(
    tx: Prisma.TransactionClient,
    usuarioIds: string[],
    titulo: string,
    cuerpo: string,
    reservaId?: string,
  ) {
    const unicos = [...new Set(usuarioIds)];
    return tx.notificacion.createMany({
      data: unicos.map((usuarioId) => ({ usuarioId, titulo, cuerpo, reservaId })),
    });
  }
}

@Controller('notificaciones')
class NotificacionesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('mias')
  mias(@UsuarioActual() u: UsuarioSesion) {
    return this.prisma.notificacion.findMany({
      where: { usuarioId: u.id },
      orderBy: { creadaEn: 'desc' },
      take: 50,
    });
  }

  @Patch(':id/leida')
  leida(@UsuarioActual() u: UsuarioSesion, @Param('id') id: string) {
    return this.prisma.notificacion.updateMany({ where: { id, usuarioId: u.id }, data: { leida: true } });
  }
}

@Global()
@Module({
  providers: [NotificacionesService],
  controllers: [NotificacionesController],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
