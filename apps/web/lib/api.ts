'use client';
/** Cliente HTTP de la web hacia la API (apps/api) y manejo de la sesión en el navegador. */
import type { RolAsignado } from '@reservaitn/shared';

/** URL base de la API; se configura en apps/web/.env.local. */
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

/** Respuesta de POST /auth/login: token JWT y usuario con sus roles vigentes y permisos efectivos. */
export interface Sesion {
  token: string;
  usuario: { id: string; nombre: string; roles: RolAsignado[]; permisos: string[] };
}

/** Sesión guardada en localStorage, o null si no hay (o el navegador bloquea el almacenamiento). */
export function sesion(): Sesion | null {
  try {
    const raw = localStorage.getItem('sesion');
    return raw ? (JSON.parse(raw) as Sesion) : null;
  } catch {
    return null;
  }
}

/** Guarda la sesión al ingresar; con null la borra (cerrar sesión). */
export function guardarSesion(s: Sesion | null) {
  try {
    if (s) localStorage.setItem('sesion', JSON.stringify(s));
    else localStorage.removeItem('sesion');
  } catch {
    /* almacenamiento bloqueado: la sesión dura lo que la pestaña */
  }
}

/** Error de la API con su código HTTP y, si es de validación, los errores por campo. */
export class ErrorApi extends Error {
  constructor(public status: number, message: string, public errores?: { campo: string; mensaje: string }[]) {
    super(message);
  }
}

/**
 * Llama a la API con el token de la sesión. `ruta` es relativa a BASE (ej. "/reservas/mias").
 * Lanza ErrorApi si la respuesta no es 2xx; un 401 con sesión la cierra y vuelve al login.
 */
export async function api<T>(ruta: string, init: RequestInit = {}): Promise<T> {
  const s = sesion();
  let res: Response;
  try {
    res = await fetch(`${BASE}${ruta}`, {
      ...init,
      headers: {
        // Con FormData (subida del Excel) el navegador pone el content-type con su boundary
        ...(init.body instanceof FormData ? {} : { 'content-type': 'application/json' }),
        ...(s ? { authorization: `Bearer ${s.token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ErrorApi(0, 'No se pudo conectar con la API. ¿Está corriendo en el puerto 3001?');
  }
  const body = await res.json().catch(() => ({}));
  if (res.status === 401 && s) {
    guardarSesion(null);
    window.location.href = '/login';
  }
  if (!res.ok) throw new ErrorApi(res.status, body.mensaje ?? body.message ?? 'Error', body.errores);
  return body as T;
}

/** POST/PATCH con cuerpo JSON. */
export function enviar<T>(ruta: string, cuerpo: unknown = {}, method: 'POST' | 'PATCH' = 'POST'): Promise<T> {
  return api<T>(ruta, { method, body: JSON.stringify(cuerpo) });
}

/** Mensaje legible de un error de la API, incluidos los errores por campo de Zod. */
export function mensajeError(e: unknown): string {
  if (e instanceof ErrorApi && e.errores?.length) return e.errores.map((x) => x.mensaje).join(' · ');
  return (e as Error).message;
}

/** Descarga un archivo de la API (con la sesión) y lo guarda con el nombre que indica el servidor. */
export async function descargar(ruta: string, nombrePorDefecto: string) {
  const s = sesion();
  const res = await fetch(`${BASE}${ruta}`, { headers: s ? { authorization: `Bearer ${s.token}` } : {} });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ErrorApi(res.status, body.mensaje ?? body.message ?? 'No se pudo generar el archivo');
  }
  const nombre = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? nombrePorDefecto;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
