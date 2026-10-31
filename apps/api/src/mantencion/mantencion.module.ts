import { Body, Controller, Get, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { inspeccionSchema, reporteDanioSchema } from '@reservaitn/shared';
import { PrismaService } from '../comun/prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.module';
import { RequierePermiso, UsuarioActual, type UsuarioSesion } from '../comun/auth.guard';
import { ZodPipe } from '../comun/zod.pipe';

const ordenSchema = z.object({
  espacioId: z.string().uuid(),
  tipo: z.enum(['CORRECTIVA', 'PREVENTIVA']),
  prioridad: z.enum(['BAJA', 'MEDIA', 'ALTA', 'URGENTE']).default('MEDIA'),
  reporteIds: z.array(z.string().uuid()).default([]),
  asignadaA: z.string().uuid().optional(),
  /** Bloquea el espacio (D16): crea una solicitud de MANTENCION que el anti-choques respeta. */
  bloqueo: z.object({ inicio: z.coerce.date(), fin: z.coerce.date() }).refine((b) => b.fin > b.inicio).optional(),
});
const estadoOrdenSchema = z.object({
  estado: z.enum(['ASIGNADA', 'EN_PROCESO', 'RESUELTA', 'CANCELADA']),
  asignadaA: z.string().uuid().optional(),
  solucion: z.string().trim().max(1000).optional(),
});

/** Mantención: inspecciones, daños y órdenes de trabajo (R15, R17 / E12 / WBS 1.4.10). */
@Controller('mantencion')
class MantencionController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notif: NotificacionesService,
  ) {}

  @Get('espacios/:id/inventario')
  inventario(@Param('id', ParseUUIDPipe) espacioId: string) {
    return this.prisma.espacio_item.findMany({
      where: { espacio_id: espacioId },
      select: { cantidad_esperada: true, item: { select: { id: true, codigo: true, nombre: true } } },
      orderBy: { item: { nombre: 'asc' } },
    });
  }

  /** Inspección: guarda lo contado y, como foto del momento, lo esperado (D17). */
  @RequierePermiso('inventario:registrar')
  @Post('inspecciones')
  async inspeccion(@Body(new ZodPipe(inspeccionSchema)) dto: z.infer<typeof inspeccionSchema>, @UsuarioActual() u: UsuarioSesion) {
    const esperado = await this.prisma.espacio_item.findMany({ where: { espacio_id: dto.espacioId } });
    const cantidadEsperada = (itemId: string) => esperado.find((e) => e.item_id === itemId)?.cantidad_esperada ?? 0;
    const insp = await this.prisma.conActor(u.id, (tx) =>
      tx.inspeccion.create({
        data: {
          espacio_id: dto.espacioId,
          usuario_id: u.id,
          observacion: dto.observacion,
          inspeccion_detalle: {
            create: dto.items.map((i) => ({ item_id: i.itemId, cantidad_contada: i.cantidad, cantidad_esperada: cantidadEsperada(i.itemId) })),
          },
        },
      }),
    );
    const diferencias = await this.prisma.$queryRaw`
      SELECT d.item_id, i.nombre, d.cantidad_esperada, d.cantidad_contada, d.diferencia
        FROM mantencion.v_diferencia_inventario d JOIN institucion.item i ON i.id = d.item_id
       WHERE d.inspeccion_id = ${insp.id}::uuid`;
    return { inspeccionId: insp.id, diferencias };
  }

  @RequierePermiso('danio:reportar')
  @Post('danios')
  reportar(@Body(new ZodPipe(reporteDanioSchema)) dto: z.infer<typeof reporteDanioSchema>, @UsuarioActual() u: UsuarioSesion) {
    return this.prisma.conActor(u.id, async (tx) => {
      const r = await tx.reporte_danio.create({
        data: { espacio_id: dto.espacioId, item_id: dto.itemId, reportado_por_usuario_id: u.id, descripcion: dto.descripcion, severidad: dto.severidad },
        include: { espacio: { select: { codigo: true } } },
      });
      const operaciones = await tx.usuario_rol.findMany({ where: { rol: { codigo: 'OPERACIONES' } }, select: { usuario_id: true } });
      await this.notif.notificar(
        tx,
        operaciones.map((o) => o.usuario_id),
        'DANIO_REPORTADO',
        `Daño en ${r.espacio.codigo} (${dto.severidad})`,
        dto.descripcion,
      );
      return r;
    });
  }

  @RequierePermiso('danio:gestionar')
  @Get('danios')
  danios(@Query('sinOrden') sinOrden?: string) {
    return this.prisma.reporte_danio.findMany({
      where: sinOrden === 'true' ? { orden_trabajo_id: null } : {},
      include: { espacio: { select: { codigo: true } }, orden_trabajo: { select: { id: true, estado: true } } },
      orderBy: { creado_en: 'desc' },
      take: 100,
    });
  }

  /** Crea una orden, agrupa reportes del mismo espacio (N3) y opcionalmente bloquea la sala. */
  @RequierePermiso('danio:gestionar')
  @Post('ordenes')
  crearOrden(@Body(new ZodPipe(ordenSchema)) dto: z.infer<typeof ordenSchema>, @UsuarioActual() u: UsuarioSesion) {
    return this.prisma.conActor(u.id, async (tx) => {
      let solicitudBloqueo: string | undefined;
      if (dto.bloqueo) {
        const mant = await tx.tipo_actividad.findUniqueOrThrow({ where: { codigo: 'MANTENCION' } });
        const s = await tx.solicitud.create({
          data: {
            solicitante_usuario_id: u.id,
            tipo_actividad_id: mant.id,
            origen: 'MANTENCION',
            descripcion: `Mantención ${dto.tipo.toLowerCase()}`,
            asistentes: 1,
            reserva: {
              create: { espacio_id: dto.espacioId, inicio: dto.bloqueo.inicio, fin: dto.bloqueo.fin, estado: 'PENDIENTE', expira_en: new Date(Date.now() + 3_600_000) },
            },
          },
        });
        await tx.aprobacion.create({ data: { solicitud_id: s.id, decision: 'APROBADA' } }); // automática (N4)
        solicitudBloqueo = s.id;
      }
      const orden = await tx.orden_trabajo.create({
        data: {
          espacio_id: dto.espacioId,
          tipo: dto.tipo,
          prioridad: dto.prioridad,
          estado: dto.asignadaA ? 'ASIGNADA' : 'ABIERTA',
          asignada_a_usuario_id: dto.asignadaA,
          solicitud_bloqueo_id: solicitudBloqueo,
        },
      });
      // La FK compuesta reporte_misma_sala_que_orden rechaza reportes de otro espacio
      if (dto.reporteIds.length) {
        await tx.reporte_danio.updateMany({ where: { id: { in: dto.reporteIds } }, data: { orden_trabajo_id: orden.id } });
      }
      if (dto.asignadaA) {
        await this.notif.notificar(tx, [dto.asignadaA], 'ORDEN_ASIGNADA', 'Se le asignó una orden de trabajo', `Prioridad ${dto.prioridad}`, { ordenTrabajoId: orden.id });
      }
      return orden;
    });
  }

  @RequierePermiso('danio:gestionar')
  @Patch('ordenes/:id')
  actualizarOrden(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(estadoOrdenSchema)) b: z.infer<typeof estadoOrdenSchema>, @UsuarioActual() u: UsuarioSesion) {
    return this.prisma.conActor(u.id, async (tx) => {
      const orden = await tx.orden_trabajo.findUnique({ where: { id } });
      if (!orden) throw new NotFoundException('Orden no encontrada');
      // Las restricciones de la tabla exigen responsable, fecha y solución según el estado
      return tx.orden_trabajo.update({
        where: { id },
        data: {
          estado: b.estado,
          asignada_a_usuario_id: b.asignadaA ?? orden.asignada_a_usuario_id,
          solucion: b.solucion ?? orden.solucion,
          resuelta_en: b.estado === 'RESUELTA' ? new Date() : null,
        },
      });
    });
  }
}

@Module({ controllers: [MantencionController] })
export class MantencionModule {}
