import type { EstadoReserva } from '../schemas';

/**
 * Máquina de estados de una reserva. Es la misma que aplica el trigger
 * reservas.fn_validar_transicion en la base de datos; aquí se usa para mostrar
 * en la interfaz solo las acciones posibles.
 * Quién puede aprobar se resuelve en la base (reservas.puede_aprobar).
 */
export type AccionReserva = 'APROBAR' | 'RECHAZAR' | 'CANCELAR' | 'EXPIRAR' | 'LIBERAR';

const TRANSICIONES: Record<AccionReserva, { desde: EstadoReserva[]; hacia: EstadoReserva }> = {
  APROBAR: { desde: ['PENDIENTE'], hacia: 'APROBADA' },
  RECHAZAR: { desde: ['PENDIENTE'], hacia: 'RECHAZADA' },
  CANCELAR: { desde: ['PENDIENTE', 'APROBADA'], hacia: 'CANCELADA' },
  EXPIRAR: { desde: ['PENDIENTE'], hacia: 'EXPIRADA' },
  LIBERAR: { desde: ['APROBADA'], hacia: 'LIBERADA' },
};

export function siguienteEstado(actual: EstadoReserva, accion: AccionReserva): EstadoReserva | null {
  const t = TRANSICIONES[accion];
  return t.desde.includes(actual) ? t.hacia : null;
}

/** Estados que ocupan el espacio (los mismos que considera la restricción reserva_sin_choque). */
export const ESTADOS_ACTIVOS: readonly EstadoReserva[] = ['PENDIENTE', 'APROBADA'];
