import { Body, Controller, Module, Post } from '@nestjs/common';
import { z } from 'zod';
import { sugerirSalas, type SalaCandidata } from '@reservaitn/shared';
import { PrismaService } from '../comun/prisma.service';
import { RequierePermiso, UsuarioActual, type UsuarioSesion } from '../comun/auth.guard';
import { ZodPipe } from '../comun/zod.pipe';
import { ReservasModule } from '../reservas/reservas.module';
import { ReservasService } from '../reservas/reservas.service';
import { SELECCION_ESPACIO } from '../recursos/recursos.module';

const sugerenciaSchema = z
  .object({
    inicio: z.coerce.date(),
    fin: z.coerce.date(),
    asistentes: z.number().int().positive(),
    sedeId: z.string().uuid().optional(),
    tipoEspacio: z.string().optional(), // ej. LABORATORIO
    equipamiento: z.array(z.string()).optional(), // códigos de ítems filtrables, ej. PROYECTOR
  })
  .refine((s) => s.fin > s.inicio, { message: 'La hora de término debe ser posterior al inicio', path: ['fin'] });

/** Sugerencia de espacio y alternativas (R10 / E7 / WBS 1.4.5). */
@Controller('sugerencia')
class SugerenciaController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reservas: ReservasService,
  ) {}

  @RequierePermiso('reserva:solicitar')
  @Post()
  async sugerir(@Body(new ZodPipe(sugerenciaSchema)) q: z.infer<typeof sugerenciaSchema>, @UsuarioActual() u: UsuarioSesion) {
    const [espacios, [ventana]] = await Promise.all([
      this.prisma.espacio.findMany({
        where: { activo: true, reservable: true, ...(q.tipoEspacio ? { tipo_espacio: { codigo: q.tipoEspacio } } : {}) },
        select: SELECCION_ESPACIO,
      }),
      this.prisma.$queryRaw<{ minutos: number }[]>`
        SELECT valor::int AS minutos FROM institucion.parametro WHERE clave = 'sugerencia.minutos_ventana_liberacion'`,
    ]);
    // Se consulta hasta el fin de la ventana para detectar espacios que se liberan pronto
    const ocup = await this.reservas.ocupaciones(q.inicio, new Date(q.fin.getTime() + (ventana?.minutos ?? 30) * 60_000));

    const candidatas: SalaCandidata[] = espacios.map((e) => ({
      id: e.id,
      codigo: e.codigo,
      sedeId: e.edificio.sede.id,
      capacidad: e.capacidad,
      equipamiento: e.espacio_item.filter((i) => i.item.filtrable).map((i) => i.item.codigo),
      carreraExclusivaId: e.espacio_carrera.find((c) => c.prioridad === 'EXCLUSIVO')?.carrera.id ?? null,
    }));
    const carrera = u.roles.find((r) => r.carreraId)?.carreraId ?? null;
    const r = sugerirSalas(
      { ...q, equipamientoRequerido: q.equipamiento, carreraSolicitanteId: carrera },
      candidatas,
      ocup.map((o) => ({ salaId: o.espacio_id, inicio: o.inicio, fin: o.fin })),
    );
    // Se devuelve el espacio completo (nombre, edificio, sede) para mostrarlo en la app
    const completo = (id: string) => espacios.find((e) => e.id === id)!;
    const conDetalle = (s: (typeof r.alternativas)[number]) => ({ espacio: completo(s.sala.id), esperaMin: s.esperaMin, puntaje: s.puntaje });
    return { sugerida: r.sugerida && conDetalle(r.sugerida), alternativas: r.alternativas.map(conDetalle) };
  }
}

@Module({ imports: [ReservasModule], controllers: [SugerenciaController] })
export class SugerenciaModule {}
