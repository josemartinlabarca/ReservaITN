import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';

/** Traduce la violación de la restricción anti-choques de PostgreSQL (23P01) a un 409 legible. */
export function esChoqueBD(e: unknown): boolean {
  const msg = String((e as Error)?.message ?? '');
  return msg.includes('reservas_sin_choque') || msg.includes('23P01');
}

@Catch()
export class FiltroErrores implements ExceptionFilter {
  catch(e: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (e instanceof HttpException) {
      res.status(e.getStatus()).json(e.getResponse());
      return;
    }
    if (esChoqueBD(e)) {
      res.status(409).json({ mensaje: 'La sala ya tiene una reserva aprobada en ese horario' });
      return;
    }
    console.error(e);
    res.status(500).json({ mensaje: 'Error interno' });
  }
}
