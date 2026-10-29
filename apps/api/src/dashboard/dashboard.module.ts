import { Controller, Get, Module, Query } from '@nestjs/common';
import {
  HORARIO,
  horasOcupadas,
  indiceOcupacion,
  rangoFechasSchema,
  type RangoFechas,
} from '@reservaitn/shared';
import { PrismaService } from '../comun/prisma.service';
import { RequierePermiso } from '../comun/auth.guard';
import { ZodPipe } from '../comun/zod.pipe';

/** Días hábiles (lun–sáb) en el rango × horas del horario institucional. */
export function horasDisponiblesPorSala(desde: Date, hasta: Date): number {
  const horasDia = HORARIO.cierreHora - HORARIO.aperturaHora;
  let dias = 0;
  for (let d = new Date(desde); d < hasta; d.setDate(d.getDate() + 1)) if (d.getDay() !== 0) dias++;
  return dias * horasDia;
}

/** Dashboard, trazabilidad y reportes “desde–hasta” (E9 / WBS 1.4.7). */
@Controller('dashboard')
class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @RequierePermiso('dashboard:ver')
  @Get('ocupacion')
  async ocupacion(@Query(new ZodPipe(rangoFechasSchema)) q: RangoFechas) {
    const salas = await this.prisma.sala.findMany({
      where: { activa: true, sedeId: q.sedeId },
      include: { sede: { select: { nombre: true } } },
    });
    const reservas = await this.prisma.reserva.findMany({
      where: {
        estado: 'APROBADA',
        origen: { not: 'MANTENCION' },
        inicio: { lt: q.hasta },
        fin: { gt: q.desde },
        salaId: { in: salas.map((s) => s.id) },
      },
      select: { salaId: true, inicio: true, fin: true },
    });
    const rango = { inicio: q.desde, fin: q.hasta };
    const dispSala = horasDisponiblesPorSala(q.desde, q.hasta);

    const porSala = salas
      .map((s) => {
        const horas = horasOcupadas(reservas.filter((r) => r.salaId === s.id), rango);
        return {
          salaId: s.id,
          codigo: s.codigo,
          sede: s.sede.nombre,
          tipo: s.tipo,
          horasReservadas: Math.round(horas * 10) / 10,
          indice: indiceOcupacion(horas, dispSala),
        };
      })
      .sort((a, b) => b.indice - a.indice);

    const totalHoras = porSala.reduce((acc, s) => acc + s.horasReservadas, 0);
    return {
      rango: { desde: q.desde, hasta: q.hasta },
      indiceGlobal: indiceOcupacion(totalHoras, dispSala * salas.length),
      totalReservas: reservas.length,
      porSala,
    };
  }

  @RequierePermiso('dashboard:ver')
  @Get('indicadores')
  async indicadores(@Query(new ZodPipe(rangoFechasSchema)) q: RangoFechas) {
    const where = { creadaEn: { gte: q.desde, lt: q.hasta } };
    const [total, pendientes, liberadas, decididas] = await Promise.all([
      this.prisma.reserva.count({ where }),
      this.prisma.reserva.count({ where: { ...where, estado: 'PENDIENTE' } }),
      this.prisma.reserva.count({ where: { ...where, estado: 'LIBERADA' } }),
      this.prisma.reserva.findMany({
        where: { ...where, decididaEn: { not: null }, origen: 'SOLICITUD' },
        select: { creadaEn: true, decididaEn: true },
      }),
    ]);
    const horasAprob = decididas.map((r) => (r.decididaEn!.getTime() - r.creadaEn.getTime()) / 3_600_000);
    return {
      totalReservas: total,
      pendientes,
      // Indicadores del Plan de Gestión de Beneficios
      B3_reservasNoUsadas: total ? liberadas / total : 0,
      B6_tiempoPromedioAprobacionHoras: horasAprob.length
        ? horasAprob.reduce((a, b) => a + b, 0) / horasAprob.length
        : null,
    };
  }
}

@Module({ controllers: [DashboardController] })
export class DashboardModule {}
