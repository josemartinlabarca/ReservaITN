'use client';
import type { Rol } from '@reservaitn/shared';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export interface Sesion {
  token: string;
  usuario: { id: string; nombre: string; rol: Rol; carreraId: string | null };
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
