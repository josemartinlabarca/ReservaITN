import { Controller, Get, Module, Query } from '@nestjs/common';
import { rangoFechasSchema, rankingJornadas, type RangoFechas } from '@reservaitn/shared';
import { PrismaService } from '../comun/prisma.service';
import { RequierePermiso } from '../comun/auth.guard';
import { ZodPipe } from '../comun/zod.pipe';

/** Proyección de uso por día y jornada (R14 / E10 / WBS 1.4.8). */
@Controller('proyeccion')
class ProyeccionController {
  constructor(private readonly prisma: PrismaService) {}

  @RequierePermiso('dashboard:ver')
  @Get()
  async proyeccion(@Query(new ZodPipe(rangoFechasSchema)) q: RangoFechas) {
    const reservas = await this.prisma.reserva.findMany({
      where: {
        estado: 'APROBADA',
        origen: { not: 'MANTENCION' },
        inicio: { gte: q.desde, lt: q.hasta },
        ...(q.sedeId ? { sala: { sedeId: q.sedeId } } : {}),
      },
      select: { inicio: true, fin: true },
    });
    const ranking = rankingJornadas(reservas);
    return {
      rango: { desde: q.desde, hasta: q.hasta },
      mayorUso: ranking.slice(0, 3),
      menorUso: ranking.slice(-3).reverse(),
      ranking,
    };
  }
}

@Module({ controllers: [ProyeccionController] })
export class ProyeccionModule {}
