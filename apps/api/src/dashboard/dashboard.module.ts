import { Controller, Get, Module, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { rangoFechasSchema, type RangoFechas } from '@reservaitn/shared';
import { PrismaService } from '../comun/prisma.service';
import { RequierePermiso, UsuarioActual, type UsuarioSesion } from '../comun/auth.guard';
import { ZodPipe } from '../comun/zod.pipe';
import { DashboardService } from './dashboard.service';
import { construirReporteExcel } from './reporte-excel';

export { horasDisponiblesPorSala } from './dashboard.service';

/** Dashboard, trazabilidad y reportes “desde–hasta” (E9 / WBS 1.4.7, R12, R13). */
@Controller('dashboard')
class DashboardController {
  constructor(
    private readonly svc: DashboardService,
    private readonly prisma: PrismaService,
  ) {}

  @RequierePermiso('dashboard:ver')
  @Get('ocupacion')
  async ocupacion(@Query(new ZodPipe(rangoFechasSchema)) q: RangoFechas) {
    const { reservas: _, ...resto } = await this.svc.ocupacion(q);
    return resto;
  }

  @RequierePermiso('dashboard:ver')
  @Get('indicadores')
  indicadores(@Query(new ZodPipe(rangoFechasSchema)) q: RangoFechas) {
    return this.svc.indicadores(q);
  }

  /** Todas las reservas del período con su trazabilidad (R7), incluida la cancelación. */
  @RequierePermiso('dashboard:ver')
  @Get('reservas')
  reservas(@Query(new ZodPipe(rangoFechasSchema)) q: RangoFechas) {
    return this.svc.reservas(q);
  }

  /** Reporte en Excel del período (R13): mismos datos que el dashboard. */
  @RequierePermiso('reporte:generar')
  @Get('reporte.xlsx')
  async reporteExcel(@Query(new ZodPipe(rangoFechasSchema)) q: RangoFechas, @UsuarioActual() u: UsuarioSesion, @Res() res: Response) {
    const [ocupacion, indicadores, reservas, institucion, sede] = await Promise.all([
      this.svc.ocupacion(q),
      this.svc.indicadores(q),
      this.svc.reservas(q),
      this.prisma.institucion.findFirst(),
      q.sedeId ? this.prisma.sede.findUnique({ where: { id: q.sedeId } }) : null,
    ]);
    const buffer = await construirReporteExcel({
      institucion: institucion?.nombre ?? 'Instituto Técnico del Norte',
      desde: q.desde,
      hasta: q.hasta,
      sede: sede?.nombre ?? null,
      generadoPor: u.nombre,
      ocupacion,
      indicadores,
      reservas,
    });
    const dia = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' });
    const nombre = `ReservaITN_Reporte_${dia(q.desde)}_al_${dia(new Date(q.hasta.getTime() - 1))}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.send(buffer);
  }
}

@Module({ controllers: [DashboardController], providers: [DashboardService] })
export class DashboardModule {}
