import type { Rol } from '@reservaitn/shared';
import { PrismaService } from '../src/comun/prisma.service';
import type { UsuarioSesion } from '../src/comun/auth.guard';

export const prisma = new PrismaService();

/** Sesión de un usuario demo, calculada igual que en el login. */
export async function sesion(email: string): Promise<UsuarioSesion> {
  const p = await prisma.persona.findUniqueOrThrow({ where: { email }, include: { usuario: true } });
  const id = p.usuario!.id;
  const roles = await prisma.$queryRaw<{ codigo: Rol; sede_id: string | null; carrera_id: string | null }[]>`
    SELECT codigo, sede_id, carrera_id FROM seguridad.roles_vigentes(${id}::uuid)`;
  const permisos = await prisma.$queryRaw<{ p: string }[]>`SELECT seguridad.permisos_de(${id}::uuid) AS p`;
  return {
    id,
    nombre: `${p.nombres} ${p.apellido_paterno}`,
    roles: roles.map((r) => ({ codigo: r.codigo, sedeId: r.sede_id, carreraId: r.carrera_id })),
    permisos: permisos.map((x) => x.p),
  };
}

/**
 * Un lunes al azar en el futuro lejano, distinto en cada corrida: las pruebas escriben datos
 * reales (las transacciones se confirman) y así no chocan con corridas anteriores.
 */
export function lunesAlAzar(): Date {
  const d = new Date(2090 + Math.floor(Math.random() * 9), 0, 1, 0, 0);
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7) + 7 * Math.floor(Math.random() * 50));
  return d;
}

/** Fecha local (hora de Chile) a partir de un día base. */
export function a(base: Date, dias: number, hora: string): Date {
  const [h, m] = hora.split(':').map(Number);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + dias, h, m);
}

export const espacio = (codigo: string) => prisma.espacio.findFirstOrThrow({ where: { codigo } });
