import { Body, Controller, Get, Module, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import {
  checkInSchema,
  decisionReservaSchema,
  rechazoSchema,
  reservaCreateSchema,
  type ReservaCreate,
} from '@reservaitn/shared';
import { ReservasService } from './reservas.service';
import { RequierePermiso, UsuarioActual, type UsuarioSesion } from '../comun/auth.guard';
import { ZodPipe } from '../comun/zod.pipe';

const ocupacionSchema = z.object({
  desde: z.coerce.date(),
  hasta: z.coerce.date(),
  espacioId: z.string().uuid().optional(),
});
type Decision = z.infer<typeof decisionReservaSchema>;

/** Reservas: cada fecha concreta en un espacio (E6 / WBS 1.4.4). */
@Controller('reservas')
class ReservasController {
  constructor(private readonly svc: ReservasService) {}

  @Get('ocupacion')
  ocupacion(@Query(new ZodPipe(ocupacionSchema)) q: z.infer<typeof ocupacionSchema>) {
    return this.svc.ocupaciones(q.desde, q.hasta, q.espacioId);
  }

  @Get('mias')
  mias(@UsuarioActual() u: UsuarioSesion) {
    return this.svc.mias(u);
  }

  /** Crea una solicitud con una reserva, o con una por semana si trae `repetirHasta`. */
  @RequierePermiso('reserva:solicitar')
  @Post()
  solicitar(@Body(new ZodPipe(reservaCreateSchema())) dto: ReservaCreate, @UsuarioActual() u: UsuarioSesion) {
    return this.svc.solicitar(dto, u);
  }

  @Post('check-in')
  checkIn(@Body(new ZodPipe(checkInSchema)) b: z.infer<typeof checkInSchema>, @UsuarioActual() u: UsuarioSesion) {
    return this.svc.checkIn(b.token, u);
  }

  @Post(':id/cancelar')
  cancelar(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(decisionReservaSchema)) b: Decision, @UsuarioActual() u: UsuarioSesion) {
    return this.svc.cancelar(id, u, b.comentario);
  }

  @Get(':id/historial')
  historial(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.historial(id);
  }
}

/** Solicitudes: lo que se pide y se aprueba (D14). Una serie se decide de una vez. */
@Controller('solicitudes')
class SolicitudesController {
  constructor(private readonly svc: ReservasService) {}

  @RequierePermiso('reserva:aprobar')
  @Get('pendientes')
  pendientes(@UsuarioActual() u: UsuarioSesion) {
    return this.svc.pendientes(u);
  }

  @RequierePermiso('reserva:aprobar')
  @Post(':id/aprobar')
  aprobar(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(decisionReservaSchema)) b: Decision, @UsuarioActual() u: UsuarioSesion) {
    return this.svc.decidir(id, 'APROBADA', u, b.comentario);
  }

  @RequierePermiso('reserva:aprobar')
  @Post(':id/rechazar')
  rechazar(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(rechazoSchema)) b: z.infer<typeof rechazoSchema>, @UsuarioActual() u: UsuarioSesion) {
    return this.svc.decidir(id, 'RECHAZADA', u, b.comentario);
  }
}

@Module({ controllers: [ReservasController, SolicitudesController], providers: [ReservasService], exports: [ReservasService] })
export class ReservasModule {}
