/**
 * Roles del sistema (E4 / WBS 1.4.1). Fuente única para API, web y móvil.
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
] as const;
export type Permiso = (typeof PERMISOS)[number];

/** Matriz rol → permisos. Validar con la patrocinadora (semana 3). */
export const MATRIZ_PERMISOS: Record<Rol, readonly Permiso[]> = {
  ESTUDIANTE: ['reserva:solicitar'],
  DOCENTE: ['reserva:solicitar'],
  DIRECTOR_CARRERA: ['reserva:solicitar', 'reserva:aprobar', 'dashboard:ver', 'reporte:generar'],
  DIRECCION_ACADEMICA: [
    'reserva:solicitar',
    'reserva:aprobar',
    'planificacion:importar',
    'dashboard:ver',
    'reporte:generar',
  ],
  SUBDIRECCION: [
    'reserva:solicitar',
    'reserva:aprobar',
    'reserva:cancelar_cualquiera',
    'dashboard:ver',
    'reporte:generar',
    'recurso:gestionar',
  ],
  DATD: ['dashboard:ver', 'reporte:generar', 'usuario:gestionar'],
  OPERACIONES: [
    'recurso:gestionar',
    'planificacion:importar',
    'mantencion:planificar',
    'danio:gestionar',
    'dashboard:ver',
  ],
  ASEO_MANTENCION: ['inventario:registrar', 'danio:reportar'],
  ADMIN_TI: ['usuario:gestionar', 'recurso:gestionar', 'planificacion:importar'],
};

export function tienePermiso(rol: Rol, permiso: Permiso): boolean {
  return MATRIZ_PERMISOS[rol].includes(permiso);
}

/** Roles cuyas solicitudes quedan aprobadas automáticamente (no requieren aprobador). */
export const ROLES_AUTOAPROBADOS: readonly Rol[] = ['SUBDIRECCION', 'DIRECCION_ACADEMICA'];
