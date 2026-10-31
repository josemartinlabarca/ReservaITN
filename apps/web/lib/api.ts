'use client';
import type { RolAsignado } from '@reservaitn/shared';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export interface Sesion {
  token: string;
  usuario: { id: string; nombre: string; roles: RolAsignado[]; permisos: string[] };
}

export function sesion(): Sesion | null {
  try {
    const raw = localStorage.getItem('sesion');
    return raw ? (JSON.parse(raw) as Sesion) : null;
  } catch {
    return null;
  }
}

export function guardarSesion(s: Sesion | null) {
  if (s) localStorage.setItem('sesion', JSON.stringify(s));
  else localStorage.removeItem('sesion');
}

export class ErrorApi extends Error {
  constructor(public status: number, message: string, public errores?: { campo: string; mensaje: string }[]) {
    super(message);
  }
}

export async function api<T>(ruta: string, init: RequestInit = {}): Promise<T> {
  const s = sesion();
  const res = await fetch(`${BASE}${ruta}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(s ? { authorization: `Bearer ${s.token}` } : {}),
      ...init.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ErrorApi(res.status, body.mensaje ?? body.message ?? 'Error', body.errores);
  return body as T;
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
