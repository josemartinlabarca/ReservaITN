'use client';
import { ConPermiso } from '@/components/Panel';
import { Cabecera } from '@/components/ui';
import { AdminEspacios } from '@/components/Administracion';

/** Salas, laboratorios y demás espacios de las dos sedes, con equipamiento y código QR (WBS 1.4.2, R8). */
export default function Salas() {
  return (
    <ConPermiso permiso="recurso:gestionar">
      <Cabecera miga="Gestión" titulo="Salas y laboratorios" sub="Catálogo de espacios de ambas sedes: capacidad, equipamiento, accesibilidad y código QR de check-in." />
      <AdminEspacios />
    </ConPermiso>
  );
}
