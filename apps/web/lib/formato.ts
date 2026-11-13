/** Textos legibles y formato de fechas, porcentajes y archivos para la web (español de Chile). */
import type { EstadoReserva, Rol } from '@reservaitn/shared';

/** Nombres legibles de los roles (E4). */
export const ROL_NOMBRE: Record<Rol, string> = {
  ESTUDIANTE: 'Estudiante',
  DOCENTE: 'Docente',
  DIRECTOR_CARRERA: 'Director de carrera',
  DIRECCION_ACADEMICA: 'Dirección Académica',
  SUBDIRECCION: 'Subdirección',
  DATD: 'DATD',
  OPERACIONES: 'Operaciones',
  ASEO_MANTENCION: 'Aseo y mantención',
  ADMIN_TI: 'Encargado de informática',
};

/** Texto y tono de color (clase de .badge) por estado de reserva. */
export const ESTADO: Record<EstadoReserva, { texto: string; tono: string }> = {
  PENDIENTE: { texto: 'Pendiente', tono: 'warn' },
  APROBADA: { texto: 'Aprobada', tono: 'ok' },
  RECHAZADA: { texto: 'Rechazada', tono: 'danger' },
  CANCELADA: { texto: 'Cancelada', tono: '' },
  EXPIRADA: { texto: 'Expirada', tono: '' },
  LIBERADA: { texto: 'Liberada', tono: 'info' },
};

/** Nombre del rol principal de la sesión (el de más alcance, según el orden de ROLES). */
export function rolPrincipal(roles: { codigo: Rol }[]): string {
  const orden: Rol[] = ['SUBDIRECCION', 'DATD', 'DIRECCION_ACADEMICA', 'ADMIN_TI', 'OPERACIONES', 'DIRECTOR_CARRERA', 'DOCENTE', 'ASEO_MANTENCION', 'ESTUDIANTE'];
  const r = orden.find((o) => roles.some((x) => x.codigo === o));
  return r ? ROL_NOMBRE[r] : 'Usuario';
}

/** De dónde viene la reserva: solicitud de un usuario, Excel semestral o bloqueo de mantención. */
export const ORIGEN: Record<string, string> = {
  SOLICITUD: 'Solicitud',
  PLANIFICACION: 'Planificación semestral',
  MANTENCION: 'Mantención',
};

/** Indexado por `Date.getDay()` (0 = domingo). */
export const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** yyyy-mm-dd en hora local (no UTC, para que los <input type="date"> no corran un día). */
export function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function sumarDias(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Lunes de la semana de `d`, a las 00:00. */
export function lunesDe(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7));
  return r;
}

/** "mié, 4 nov 2026" */
export const fecha = (s: string | Date) =>
  new Date(s).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
export const hora = (s: string | Date) => new Date(s).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
export const fechaHora = (s: string | Date) => `${fecha(s)}, ${hora(s)}`;
export const rangoHora = (a: string | Date, b: string | Date) => `${hora(a)} – ${hora(b)}`;
export const pct = (n: number) => `${(n * 100).toFixed(1)} %`;

/** Tiempo relativo para avisos: "hace 5 min", "hace 2 h"; sobre 30 días, la fecha. */
export function hace(s: string | Date): string {
  const min = Math.round((Date.now() - new Date(s).getTime()) / 60_000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d < 30 ? `hace ${d} d` : fecha(s);
}

/** Iniciales para el avatar: "Pedro Fernández" → "PF". */
export function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

/** Descarga un CSV compatible con Excel en español (separador ";" y BOM UTF-8). Reportes R13. */
export function descargarCsv(nombre: string, filas: (string | number)[][]) {
  const csv = filas
    .map((f) => f.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
