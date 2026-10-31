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
  const { permisos, roles } = s.usuario;
  return (
    <header className="top">
      <strong>ReservaITN</strong>
      {tienePermiso(permisos, 'dashboard:ver') && <Link href="/dashboard">Dashboard</Link>}
      {tienePermiso(permisos, 'reserva:aprobar') && <Link href="/aprobaciones">Aprobaciones</Link>}
      <span>{s.usuario.nombre} · {roles.map((r) => r.codigo).join(', ')}</span>
      <button className="sec" onClick={() => { guardarSesion(null); router.replace('/login'); }}>Salir</button>
    </header>
  );
}
