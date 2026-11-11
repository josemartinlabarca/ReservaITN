import { Body, Controller, Get, Global, Injectable, Module, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { dispositivoSchema } from '@reservaitn/shared';
import { ZodPipe } from '../comun/zod.pipe';
import { PrismaService, type Tx } from '../comun/prisma.service';
import { UsuarioActual, type UsuarioSesion } from '../comun/auth.guard';
import { EnviosService } from './envios.service';

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

  @Get('no-leidas')
  async noLeidas(@UsuarioActual() u: UsuarioSesion) {
    return { total: await this.prisma.notificacion.count({ where: { usuario_id: u.id, leida_en: null } }) };
  }

  /**
   * Registra el celular para recibir notificaciones push. Si el mismo celular se usó con otra
   * cuenta, pasa a la cuenta actual (un token = un dispositivo).
   */
  @Post('dispositivos')
  async registrarDispositivo(@Body(new ZodPipe(dispositivoSchema)) d: z.infer<typeof dispositivoSchema>, @UsuarioActual() u: UsuarioSesion) {
    await this.prisma.dispositivo.upsert({
      where: { token_push: d.token },
      create: { usuario_id: u.id, token_push: d.token, plataforma: d.plataforma },
      update: { usuario_id: u.id, plataforma: d.plataforma, ultimo_uso: new Date() },
    });
    return { registrado: true };
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
  providers: [NotificacionesService, EnviosService],
  controllers: [NotificacionesController],
  exports: [NotificacionesService, EnviosService],
})
export class NotificacionesModule {}
