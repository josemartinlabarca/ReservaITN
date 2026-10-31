import { Controller, Get, Global, Injectable, Module, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { PrismaService, type Tx } from '../comun/prisma.service';
import { UsuarioActual, type UsuarioSesion } from '../comun/auth.guard';

export interface Referencia {
  solicitudId?: string;
  reservaId?: string;
  ordenTrabajoId?: string;
}

/**
 * Notificaciones (R6 / E8 / WBS 1.4.6, D18). Se escriben en la misma transacción que la acción
 * de negocio (patrón outbox): la bandeja de la app queda en `notificacion` y los correos y push
 * en `envio`, que un proceso despacha con reintentos. Respeta las preferencias de cada usuario.
 */
@Injectable()
export class NotificacionesService {
  async notificar(tx: Tx, usuarioIds: string[], evento: string, titulo: string, cuerpo: string, ref: Referencia = {}) {
    const unicos = [...new Set(usuarioIds)];
    if (!unicos.length) return;
    const [apagadas, conDispositivo] = await Promise.all([
      tx.preferencia.findMany({ where: { usuario_id: { in: unicos }, evento_codigo: evento, activo: false } }),
      tx.dispositivo.findMany({ where: { usuario_id: { in: unicos } }, select: { usuario_id: true }, distinct: ['usuario_id'] }),
    ]);
    const apagado = (u: string, canal: string) => apagadas.some((p) => p.usuario_id === u && p.canal === canal);
    const tienePush = new Set(conDispositivo.map((d) => d.usuario_id));

    for (const usuarioId of unicos) {
      const canales = [
        ...(!apagado(usuarioId, 'CORREO') ? (['CORREO'] as const) : []),
        ...(tienePush.has(usuarioId) && !apagado(usuarioId, 'PUSH') ? (['PUSH'] as const) : []),
      ];
      if (apagado(usuarioId, 'APP') && canales.length === 0) continue;
      await tx.notificacion.create({
        data: {
          usuario_id: usuarioId,
          evento_codigo: evento,
          titulo,
          cuerpo,
          solicitud_id: ref.solicitudId,
          reserva_id: ref.reservaId,
          orden_trabajo_id: ref.ordenTrabajoId,
          envio: { create: canales.map((canal) => ({ canal })) },
        },
      });
    }
  }
}

@Controller('notificaciones')
class NotificacionesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('mias')
  mias(@UsuarioActual() u: UsuarioSesion) {
    return this.prisma.notificacion.findMany({
      where: { usuario_id: u.id },
      select: { id: true, evento_codigo: true, titulo: true, cuerpo: true, leida_en: true, creado_en: true, solicitud_id: true, reserva_id: true },
      orderBy: { creado_en: 'desc' },
      take: 50,
    });
  }

  @Patch(':id/leida')
  leida(@UsuarioActual() u: UsuarioSesion, @Param('id', ParseUUIDPipe) id: string) {
    return this.prisma.notificacion.updateMany({
      where: { id, usuario_id: u.id, leida_en: null },
      data: { leida_en: new Date() },
    });
  }
}

@Global()
@Module({
  providers: [NotificacionesService],
  controllers: [NotificacionesController],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
