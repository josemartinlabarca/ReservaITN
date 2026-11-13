/**
 * Forma de las respuestas JSON de la API v1 que usan varias pantallas. Las fechas llegan como
 * texto ISO. Si cambia un `select` en apps/api, actualizar aquí el tipo correspondiente.
 */
import type { EstadoReserva } from '@reservaitn/shared';

/** GET /reservas/mias: reservas del usuario desde hace 7 días en adelante. */
export interface ReservaPropia {
  id: string;
  inicio: string;
  fin: string;
  estado: EstadoReserva;
  expira_en: string | null;
  espacio: { codigo: string; nombre: string; edificio: { sede: { nombre: string } } };
  solicitud: { id: string; descripcion: string; asistentes: number; origen: string };
  check_in: { registrado_en: string } | null;
  cancelacion: { motivo: string | null; cancelado_en: string } | null;
}

/** GET /notificaciones/mias: últimos 50 avisos. */
export interface Notificacion {
  id: string;
  evento_codigo: string;
  titulo: string;
  cuerpo: string;
  leida_en: string | null;
  creado_en: string;
  solicitud_id: string | null;
  reserva_id: string | null;
}
