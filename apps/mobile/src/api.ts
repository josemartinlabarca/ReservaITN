import * as SecureStore from 'expo-secure-store';
import type { Rol } from '@reservaitn/shared';

/** En un dispositivo físico, cambiar por la IP del PC (ej. http://192.168.1.10:3001/api). */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export interface Sesion {
  token: string;
  usuario: { id: string; nombre: string; rol: Rol; carreraId: string | null };
}

let actual: Sesion | null = null;

export async function cargarSesion(): Promise<Sesion | null> {
  const raw = await SecureStore.getItemAsync('sesion');
  actual = raw ? (JSON.parse(raw) as Sesion) : null;
  return actual;
}

export async function guardarSesion(s: Sesion | null) {
  actual = s;
  if (s) await SecureStore.setItemAsync('sesion', JSON.stringify(s));
  else await SecureStore.deleteItemAsync('sesion');
}

export async function api<T>(ruta: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${ruta}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(actual ? { authorization: `Bearer ${actual.token}` } : {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detalle = body.errores?.map((e: { mensaje: string }) => e.mensaje).join('\n');
    throw new Error(detalle || body.mensaje || body.message || 'Error de conexión');
  }
  return body as T;
}
