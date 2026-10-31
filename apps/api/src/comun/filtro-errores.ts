import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';

/**
 * Traduce los rechazos de la base de datos a respuestas HTTP. La base es la última línea de
 * defensa (ADR 0004): si una regla se viola, el mensaje que llega al usuario debe ser claro.
 */
const MENSAJES: Record<string, { status: number; mensaje: string }> = {
  reserva_sin_choque: { status: 409, mensaje: 'El espacio ya está reservado o solicitado en ese horario' },
  patron_sin_solape: { status: 409, mensaje: 'La serie tiene horarios que se solapan' },
  aprobacion_solicitud_id_key: { status: 409, mensaje: 'La solicitud ya fue decidida' },
  aprobacion_rechazo_con_motivo: { status: 400, mensaje: 'Indique el motivo del rechazo' },
  persona_rut_valido: { status: 400, mensaje: 'RUT inválido' },
  persona_email_key: { status: 409, mensaje: 'Ya existe una persona con ese correo' },
  persona_tipo_documento_numero_documento_key: { status: 409, mensaje: 'Ya existe una persona con ese documento' },
  reporte_misma_sala_que_orden: { status: 400, mensaje: 'El reporte y la orden de trabajo deben ser del mismo espacio' },
};

/** Nombre de la restricción violada, o null si el error no viene de una restricción conocida. */
export function restriccionViolada(e: unknown): string | null {
  const texto = String((e as Error)?.message ?? '') + JSON.stringify((e as { meta?: unknown })?.meta ?? '');
  return Object.keys(MENSAJES).find((r) => texto.includes(r)) ?? null;
}

export function esChoqueBD(e: unknown): boolean {
  return restriccionViolada(e) === 'reserva_sin_choque';
}

/** Mensaje de un RAISE EXCEPTION de los triggers (ej. "Transición de reserva no permitida"). */
function mensajeDeTrigger(e: unknown): string | null {
  const texto = String((e as Error)?.message ?? '') + JSON.stringify((e as { meta?: unknown })?.meta ?? '');
  const m = /(Transición de reserva no permitida[^"`\\]*|Solo se puede hacer check-in[^"`\\]*|El check-in debe hacerse[^"`\\]*|no tiene reservas pendientes[^"`\\]*|es obligatorio y no se puede desactivar|debe indicar el motivo[^"`\\]*)/.exec(texto);
  return m ? m[1].trim() : null;
}

@Catch()
export class FiltroErrores implements ExceptionFilter {
  catch(e: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (e instanceof HttpException) {
      res.status(e.getStatus()).json(e.getResponse());
      return;
    }
    const restriccion = restriccionViolada(e);
    if (restriccion) {
      const { status, mensaje } = MENSAJES[restriccion];
      res.status(status).json({ mensaje, restriccion });
      return;
    }
    // Unicidad violada (Prisma informa los campos, no el nombre de la restricción)
    if ((e as { code?: string })?.code === 'P2002') {
      res.status(409).json({ mensaje: 'Ya existe un registro con esos datos', campos: (e as { meta?: { target?: unknown } }).meta?.target });
      return;
    }
    const trigger = mensajeDeTrigger(e);
    if (trigger) {
      res.status(409).json({ mensaje: trigger });
      return;
    }
    console.error(e);
    res.status(500).json({ mensaje: 'Error interno' });
  }
}
