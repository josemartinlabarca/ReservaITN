import { BadRequestException, Body, ConflictException, Controller, Get, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
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

/** Transiciones permitidas de una orden de trabajo. RESUELTA y CANCELADA son finales. */
const TRANSICIONES_ORDEN: Record<string, string[]> = {
  ABIERTA: ['ASIGNADA', 'CANCELADA'],
  ASIGNADA: ['ASIGNADA', 'EN_PROCESO', 'RESUELTA', 'CANCELADA'],
  EN_PROCESO: ['ASIGNADA', 'RESUELTA', 'CANCELADA'],
  RESUELTA: [],
  CANCELADA: [],
};
const nombre = (p: { nombres: string; apellido_paterno: string }) => `${p.nombres} ${p.apellido_paterno}`;

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
      include: {
        espacio: { select: { id: true, codigo: true, nombre: true } },
        item: { select: { nombre: true } },
        usuario: { select: { persona: { select: { nombres: true, apellido_paterno: true } } } },
        orden_trabajo: { select: { id: true, estado: true } },
      },
      orderBy: { creado_en: 'desc' },
      take: 200,
    });
  }

  /** Personal al que se le puede asignar una orden (aseo y mantención, operaciones). */
  @RequierePermiso('danio:gestionar')
  @Get('personal')
  async personal() {
    const us = await this.prisma.usuario.findMany({
      where: { estado: 'ACTIVO', usuario_rol: { some: { rol: { codigo: { in: ['ASEO_MANTENCION', 'OPERACIONES'] } } } } },
      select: { id: true, persona: { select: { nombres: true, apellido_paterno: true } }, usuario_rol: { select: { rol: { select: { codigo: true } } } } },
    });
    return us.map((u) => ({ id: u.id, nombre: nombre(u.persona), roles: u.usuario_rol.map((r) => r.rol.codigo) }));
  }

  /** Órdenes de trabajo con su espacio, responsable, reportes y bloqueo de la sala. */
  @RequierePermiso('danio:gestionar')
  @Get('ordenes')
  ordenes(@Query('abiertas') abiertas?: string) {
    return this.prisma.orden_trabajo.findMany({
      where: abiertas === 'true' ? { estado: { in: ['ABIERTA', 'ASIGNADA', 'EN_PROCESO'] } } : {},
      include: {
        espacio: { select: { id: true, codigo: true, nombre: true } },
        usuario: { select: { persona: { select: { nombres: true, apellido_paterno: true } } } },
        reporte_danio: { select: { id: true, descripcion: true, severidad: true, creado_en: true } },
        solicitud: { select: { reserva: { select: { inicio: true, fin: true, estado: true }, orderBy: { inicio: 'asc' } } } },
      },
      orderBy: [{ creado_en: 'desc' }],
      take: 200,
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

  /**
   * Cambia el estado de una orden (asignar, en proceso, resolver, cancelar). Al cerrarla, si tenía
   * la sala bloqueada, el bloqueo que queda por delante se cancela y la sala se libera de inmediato.
   */
  @RequierePermiso('danio:gestionar')
  @Patch('ordenes/:id')
  actualizarOrden(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(estadoOrdenSchema)) b: z.infer<typeof estadoOrdenSchema>, @UsuarioActual() u: UsuarioSesion) {
    return this.prisma.conActor(u.id, async (tx) => {
      const orden = await tx.orden_trabajo.findUnique({ where: { id }, include: { espacio: { select: { codigo: true } } } });
      if (!orden) throw new NotFoundException('Orden no encontrada');
      if (!TRANSICIONES_ORDEN[orden.estado].includes(b.estado))
        throw new ConflictException(`Una orden ${orden.estado.toLowerCase()} no puede pasar a ${b.estado.toLowerCase()}`);
      if (b.estado === 'ASIGNADA' && !b.asignadaA) throw new BadRequestException('Indique a quién se asigna');
      if (b.estado === 'RESUELTA' && !(b.solucion ?? '').trim()) throw new BadRequestException('Describa la solución aplicada');

      // Las restricciones de la tabla también exigen responsable, fecha y solución según el estado
      const actualizada = await tx.orden_trabajo.update({
        where: { id },
        data: {
          estado: b.estado,
          asignada_a_usuario_id: b.asignadaA ?? orden.asignada_a_usuario_id,
          solucion: b.solucion ?? orden.solucion,
          resuelta_en: b.estado === 'RESUELTA' ? new Date() : null,
        },
      });

      if ((b.estado === 'RESUELTA' || b.estado === 'CANCELADA') && orden.solicitud_bloqueo_id) {
        const pendientes = await tx.reserva.findMany({
          where: { solicitud_id: orden.solicitud_bloqueo_id, estado: 'APROBADA', fin: { gt: new Date() } },
          select: { id: true },
        });
        for (const r of pendientes) {
          await tx.reserva.update({ where: { id: r.id }, data: { estado: 'CANCELADA' } });
          await tx.cancelacion.create({
            data: { reserva_id: r.id, usuario_id: u.id, motivo: `Orden de trabajo ${b.estado === 'RESUELTA' ? 'resuelta' : 'cancelada'}: la sala queda disponible` },
          });
        }
      }
      if (b.estado === 'ASIGNADA' && b.asignadaA && b.asignadaA !== orden.asignada_a_usuario_id) {
        await this.notif.notificar(
          tx,
          [b.asignadaA],
          'ORDEN_ASIGNADA',
          `Se le asignó una orden de trabajo en ${orden.espacio.codigo}`,
          `Prioridad ${orden.prioridad.toLowerCase()} · ${orden.tipo === 'CORRECTIVA' ? 'reparación' : 'mantención preventiva'}`,
          { ordenTrabajoId: id },
        );
      }
      return actualizada;
    });
  }
}

export { MantencionController };

@Module({ controllers: [MantencionController] })
export class MantencionModule {}
