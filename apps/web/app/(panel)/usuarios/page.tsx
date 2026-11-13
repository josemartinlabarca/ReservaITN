'use client';
import { ConPermiso } from '@/components/Panel';
import { Cabecera } from '@/components/ui';
import { AdminUsuarios } from '@/components/Administracion';

/** Cuentas, roles y ámbito de cada rol por sede o carrera (WBS 1.4.1, D2). */
export default function Usuarios() {
  return (
    <ConPermiso permiso="usuario:gestionar">
      <Cabecera miga="Gestión" titulo="Usuarios" sub="Cuentas del ITN con sus roles; un rol puede limitarse a una sede o a una carrera." />
      <AdminUsuarios />
    </ConPermiso>
  );
}
