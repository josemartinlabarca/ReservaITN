'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { tienePermiso } from '@reservaitn/shared';
import { guardarSesion, sesion, type Sesion } from '@/lib/api';

export function Encabezado() {
  const router = useRouter();
  const [s, setS] = useState<Sesion | null>(null);
  useEffect(() => {
    const actual = sesion();
    if (!actual) router.replace('/login');
    setS(actual);
  }, [router]);
  if (!s) return null;
  const rol = s.usuario.rol;
  return (
    <header className="top">
      <strong>ReservaITN</strong>
      {tienePermiso(rol, 'dashboard:ver') && <Link href="/dashboard">Dashboard</Link>}
      {tienePermiso(rol, 'reserva:aprobar') && <Link href="/aprobaciones">Aprobaciones</Link>}
      <span>{s.usuario.nombre} · {rol}</span>
      <button className="sec" onClick={() => { guardarSesion(null); router.replace('/login'); }}>Salir</button>
    </header>
  );
}
