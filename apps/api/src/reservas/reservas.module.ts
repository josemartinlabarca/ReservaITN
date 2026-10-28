import { Body, Controller, Get, Module, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { decisionReservaSchema, reservaCreateSchema, type ReservaCreate } from '@reservaitn/shared';
import { ReservasService } from './reservas.service';
import { RequierePermiso, UsuarioActual, type UsuarioSesion } from '../comun/auth.guard';
import { ZodPipe } from '../comun/zod.pipe';

const disponibilidadSchema = z.object({
  desde: z.coerce.date(),
  hasta: z.coerce.date(),
  salaId: z.string().uuid().optional(),
});
const sugerenciaSchema = z.object({
  inicio: z.coerce.date(),
  fin: z.coerce.date(),
  asistentes: z.number().int().positive(),
  sedeId: z.string().uuid().optional(),
  equipamiento: z.array(z.string()).optional(),
});
type Decision = z.infer<typeof decisionReservaSchema>;

/** Reservas, aprobaciones, cancelación y anti-choques (E6 / WBS 1.4.4) + sugerencia (E7 / 1.4.5). */
@Controller('reservas')
class ReservasController {
  constructor(private readonly svc: ReservasService) {}

  @Get('ocupacion')
  ocupacion(@Query(new ZodPipe(disponibilidadSchema)) q: z.infer<typeof disponibilidadSchema>) {
    return this.svc.ocupaciones(q.desde, q.hasta, q.salaId);
  }

  @RequierePermiso('reserva:aprobar')
  @Get('pendientes')
  pendientes(@UsuarioActual() u: UsuarioSesion) {
    return this.svc.pendientes(u);
  }

  @RequierePermiso('reserva:solicitar')
  @Post()
  solicitar(@Body(new ZodPipe(reservaCreateSchema())) dto: ReservaCreate, @UsuarioActual() u: UsuarioSesion) {
    return this.svc.solicitar(dto, u);
  }

  @RequierePermiso('reserva:solicitar')
  @Post('sugerencia')
  sugerir(@Body(new ZodPipe(sugerenciaSchema)) dto: z.infer<typeof sugerenciaSchema>, @UsuarioActual() u: UsuarioSesion) {
    return this.svc.sugerir(dto, u);
  }

  @RequierePermiso('reserva:aprobar')
  @Post(':id/aprobar')
  aprobar(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(decisionReservaSchema)) b: Decision, @UsuarioActual() u: UsuarioSesion) {
    return this.svc.decidir(id, 'APROBAR', u, b.comentario);
  }

  @RequierePermiso('reserva:aprobar')
  @Post(':id/rechazar')
  rechazar(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(decisionReservaSchema)) b: Decision, @UsuarioActual() u: UsuarioSesion) {
    return this.svc.decidir(id, 'RECHAZAR', u, b.comentario);
  }

  @Post(':id/cancelar')
  cancelar(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(decisionReservaSchema)) b: Decision, @UsuarioActual() u: UsuarioSesion) {
    return this.svc.decidir(id, 'CANCELAR', u, b.comentario);
  }

  @Get(':id/historial')
  historial(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.historial(id);
  }
}

@Module({ controllers: [ReservasController], providers: [ReservasService], exports: [ReservasService] })
export class ReservasModule {}
