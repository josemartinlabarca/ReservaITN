import { Body, Controller, Get, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { conteoInventarioSchema, reporteDanioSchema } from '@reservaitn/shared';
import { PrismaService } from '../comun/prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.module';
import { RequierePermiso, UsuarioActual, type UsuarioSesion } from '../comun/auth.guard';
import { ZodPipe } from '../comun/zod.pipe';

/** Mantención y aseo: inventario por sala y reporte de daños (R15, R17 / E12 / WBS 1.4.10). */
@Controller('mantencion')
class MantencionController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notif: NotificacionesService,
  ) {}

  @Get('salas/:salaId/inventario')
  inventario(@Param('salaId', ParseUUIDPipe) salaId: string) {
    return this.prisma.itemInventario.findMany({ where: { salaId }, orderBy: { nombre: 'asc' } });
  }

  @RequierePermiso('inventario:registrar')
  @Post('inventario')
  async conteo(
    @Body(new ZodPipe(conteoInventarioSchema)) dto: z.infer<typeof conteoInventarioSchema>,
    @UsuarioActual() u: UsuarioSesion,
  ) {
    await this.prisma.conteoInventario.createMany({
      data: dto.items.map((i) => ({ itemId: i.itemId, cantidad: i.cantidad, usuarioId: u.id })),
    });
    return { registrados: dto.items.length };
  }

  @RequierePermiso('danio:reportar')
  @Post('danios')
  reportar(
    @Body(new ZodPipe(reporteDanioSchema)) dto: z.infer<typeof reporteDanioSchema>,
    @UsuarioActual() u: UsuarioSesion,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.reporteDanio.create({ data: { ...dto, reportadoPorId: u.id }, include: { sala: true } });
      const operaciones = await tx.usuario.findMany({ where: { rol: 'OPERACIONES', activo: true }, select: { id: true } });
      await this.notif.notificar(
        tx,
        operaciones.map((o) => o.id),
        `Daño reportado en ${r.sala.codigo} (${dto.severidad})`,
        dto.descripcion,
      );
      return r;
    });
  }

  @RequierePermiso('danio:gestionar')
  @Get('danios')
  danios(@Query('estado') estado?: 'ABIERTO' | 'EN_PROCESO' | 'RESUELTO') {
    return this.prisma.reporteDanio.findMany({
      where: { estado },
      include: { sala: { select: { codigo: true } }, reportadoPor: { select: { nombre: true } } },
      orderBy: { creadoEn: 'desc' },
    });
  }

  @RequierePermiso('danio:gestionar')
  @Patch('danios/:id')
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(z.object({ estado: z.enum(['EN_PROCESO', 'RESUELTO']) }))) b: { estado: 'EN_PROCESO' | 'RESUELTO' },
  ) {
    return this.prisma.reporteDanio.update({
      where: { id },
      data: { estado: b.estado, resueltoEn: b.estado === 'RESUELTO' ? new Date() : null },
    });
  }
}

@Module({ controllers: [MantencionController] })
export class MantencionModule {}
