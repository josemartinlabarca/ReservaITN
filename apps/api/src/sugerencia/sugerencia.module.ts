import { Body, Controller, Module, Post } from '@nestjs/common';
import { z } from 'zod';
import { sugerirSalas } from '@reservaitn/shared';
import { PrismaService } from '../comun/prisma.service';
import { RequierePermiso, UsuarioActual, type UsuarioSesion } from '../comun/auth.guard';
import { ZodPipe } from '../comun/zod.pipe';
import { ReservasModule } from '../reservas/reservas.module';
import { ReservasService } from '../reservas/reservas.service';

const sugerenciaSchema = z
  .object({
    inicio: z.coerce.date(),
    fin: z.coerce.date(),
    asistentes: z.number().int().positive(),
    sedeId: z.string().uuid().optional(),
    equipamiento: z.array(z.string()).optional(),
  })
  .refine((s) => s.fin > s.inicio, { message: 'La hora de término debe ser posterior al inicio', path: ['fin'] });

/** Sugerencia de sala y alternativas (R10 / E7 / WBS 1.4.5). */
@Controller('sugerencia')
class SugerenciaController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reservas: ReservasService,
  ) {}

  @RequierePermiso('reserva:solicitar')
  @Post()
  async sugerir(@Body(new ZodPipe(sugerenciaSchema)) q: z.infer<typeof sugerenciaSchema>, @UsuarioActual() u: UsuarioSesion) {
    const salas = await this.prisma.sala.findMany({ where: { activa: true } });
    // Se consulta hasta 30 min después del fin para detectar salas que se liberan pronto
    const ocup = await this.reservas.ocupaciones(q.inicio, new Date(q.fin.getTime() + 30 * 60_000));
    return sugerirSalas(
      { ...q, equipamientoRequerido: q.equipamiento, carreraSolicitanteId: u.carreraId },
      salas,
      ocup,
    );
  }
}

@Module({ imports: [ReservasModule], controllers: [SugerenciaController] })
export class SugerenciaModule {}
