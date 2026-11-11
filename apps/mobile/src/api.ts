import * as SecureStore from 'expo-secure-store';
import type { RolAsignado } from '@reservaitn/shared';

/**
 * Dirección de la API. En el celular, `localhost` es el propio celular: hay que usar la IP del
 * computador en la red WiFi, en apps/mobile/.env → EXPO_PUBLIC_API_URL=http://192.168.1.10:3001/api
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export interface Sesion {
  token: string;
  usuario: { id: string; nombre: string; roles: RolAsignado[]; permisos: string[] };
}

let actual: Sesion | null = null;
let alExpirar: (() => void) | null = null;

/** Si el almacenamiento seguro falla, la sesión queda solo en memoria (se pide entrar de nuevo al reabrir). */
export async function cargarSesion(): Promise<Sesion | null> {
  try {
    const raw = await SecureStore.getItemAsync('sesion');
    actual = raw ? (JSON.parse(raw) as Sesion) : null;
  } catch {
    actual = null;
  }
  return actual;
}

export const sesionActual = () => actual;
export const tiene = (permiso: string) => actual?.usuario.permisos.includes(permiso) ?? false;
export const esEstudiante = () => actual?.usuario.roles.some((r) => r.codigo === 'ESTUDIANTE') ?? false;

/** La app avisa aquí cuando la sesión venció (401) para volver al inicio de sesión. */
export function alExpirarSesion(fn: () => void) {
  alExpirar = fn;
}

export async function guardarSesion(s: Sesion | null) {
  actual = s;
  try {
    if (s) await SecureStore.setItemAsync('sesion', JSON.stringify(s));
    else await SecureStore.deleteItemAsync('sesion');
  } catch {
    // sin almacenamiento seguro disponible: la sesión sigue en memoria
  }
}

export async function api<T>(ruta: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${ruta}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(actual ? { authorization: `Bearer ${actual.token}` } : {}),
      },
    });
  } catch {
    throw new Error(
      `No se pudo conectar con el servidor (${API_URL}). Revise que el computador y el celular estén en la misma red WiFi y que la API esté corriendo.`,
    );
  }
  const body = await res.json().catch(() => ({}));
  if (res.status === 401 && actual) {
    await guardarSesion(null);
    alExpirar?.();
  }
  if (!res.ok) {
    const detalle = body.errores?.map((e: { mensaje: string }) => e.mensaje).join('\n');
    throw new Error(detalle || body.mensaje || body.message || `Error ${res.status}`);
  }
  return body as T;
}

export const post = <T,>(ruta: string, datos: unknown = {}) => api<T>(ruta, { method: 'POST', body: JSON.stringify(datos) });
