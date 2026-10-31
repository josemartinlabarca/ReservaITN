/**
 * Roles y permisos (E4 / WBS 1.4.1).
 * La fuente de verdad es la base de datos (seguridad.rol, seguridad.rol_permiso): un rol se
 * configura sin programar. Aquí solo están los códigos, para tener tipos en web, móvil y API.
 */
export const ROLES = [
  'ESTUDIANTE',
  'DOCENTE',
  'DIRECTOR_CARRERA',
  'DIRECCION_ACADEMICA',
  'SUBDIRECCION',
  'DATD', // Dirección de Administración y Transformación Digital
  'OPERACIONES',
  'ASEO_MANTENCION',
  'ADMIN_TI', // Encargado de informática
] as const;
export type Rol = (typeof ROLES)[number];

export const PERMISOS = [
  'reserva:solicitar',
  'reserva:aprobar',
  'reserva:aprobar_cualquiera',
  'reserva:cancelar_cualquiera',
  'recurso:gestionar',
  'planificacion:importar',
  'dashboard:ver',
  'reporte:generar',
  'mantencion:planificar',
  'inventario:registrar',
  'danio:reportar',
  'danio:gestionar',
  'usuario:gestionar',
  'regla:gestionar',
] as const;
export type Permiso = (typeof PERMISOS)[number];

/** Rol asignado con su ámbito (D2): sin sede ni carrera = toda la institución. */
export interface RolAsignado {
  codigo: Rol;
  sedeId: string | null;
  carreraId: string | null;
}

/** Los permisos efectivos llegan en la sesión (unión de los permisos de los roles vigentes). */
export function tienePermiso(permisos: readonly string[], permiso: Permiso): boolean {
  return permisos.includes(permiso);
}
