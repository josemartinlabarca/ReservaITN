import { z } from 'zod';
import { ROLES } from './roles';
import { rutValido, normalizarRut } from './validaciones';

/** Reglas institucionales de horario. Ajustar con el cliente (supuestos del Plan de Alcance). */
export const HORARIO = {
  aperturaHora: 8, // 08:00
  cierreHora: 23, // 23:00
  duracionMinMin: 30,
  duracionMaxHoras: 6,
  anticipacionMaxDias: 120,
} as const;

export const ESTADOS_RESERVA = [
  'PENDIENTE',
  'APROBADA',
  'RECHAZADA',
  'CANCELADA',
  'EXPIRADA',
  'LIBERADA',
] as const;
export type EstadoReserva = (typeof ESTADOS_RESERVA)[number];

export const ORIGENES_RESERVA = ['SOLICITUD', 'PLANIFICACION', 'MANTENCION'] as const;
/** Catálogo inicial (reservas.tipo_actividad); el cliente puede agregar más. */
export const TIPOS_ACTIVIDAD = ['CLASE', 'EVALUACION', 'ESTUDIO', 'REUNION', 'EVENTO', 'MANTENCION'] as const;
const codigoCatalogo = z.string().regex(/^[A-Z_]+$/, 'Código inválido');

export const rutSchema = z
  .string()
  .transform(normalizarRut)
  .refine(rutValido, { message: 'RUT inválido' });

export const usuarioCreateSchema = z
  .object({
    tipoDocumento: z.enum(['RUT', 'PAS', 'DNI']),
    numeroDocumento: z.string().trim().toUpperCase(),
    nombres: z.string().trim().min(1).max(80),
    apellidoPaterno: z.string().trim().min(1).max(60),
    apellidoMaterno: z.string().trim().max(60).optional(),
    email: z.string().email('Correo inválido').toLowerCase(),
    password: z.string().min(8, 'Mínimo 8 caracteres').optional(), // sin contraseña = solo SSO (D5)
    roles: z
      .array(
        z.object({
          rol: z.enum(ROLES),
          sedeId: z.string().uuid().nullable().optional(),
          carreraId: z.string().uuid().nullable().optional(),
        }),
      )
      .min(1, 'Asigne al menos un rol'),
  })
  .superRefine((u, ctx) => {
    const doc = u.tipoDocumento === 'RUT' ? normalizarRut(u.numeroDocumento) : u.numeroDocumento;
    if (u.tipoDocumento === 'RUT' && !rutValido(doc))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'RUT inválido', path: ['numeroDocumento'] });
  })
  .transform((u) => ({
    ...u,
    numeroDocumento: u.tipoDocumento === 'RUT' ? normalizarRut(u.numeroDocumento) : u.numeroDocumento,
  }));
export type UsuarioCreate = z.infer<typeof usuarioCreateSchema>;

export const espacioCreateSchema = z.object({
  edificioId: z.string().uuid(),
  tipoEspacioId: z.string().uuid(),
  codigo: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{1,20}$/, 'Solo letras, números y guiones'),
  nombre: z.string().trim().min(2).max(80),
  piso: z.number().int().min(-5).max(50).default(1),
  capacidad: z.number().int().positive().max(2000),
  accesible: z.boolean().default(false),
  items: z
    .array(z.object({ itemId: z.string().uuid(), cantidad: z.number().int().positive() }))
    .default([]),
});
export type EspacioCreate = z.infer<typeof espacioCreateSchema>;

/** Edición de un espacio: todos los campos opcionales; `items` reemplaza el equipamiento completo. */
export const espacioUpdateSchema = espacioCreateSchema
  .omit({ edificioId: true })
  .partial()
  .extend({ activo: z.boolean().optional(), reservable: z.boolean().optional() });
export type EspacioUpdate = z.infer<typeof espacioUpdateSchema>;

/** Edición de un usuario: estado, roles (reemplaza todos) y contraseña nueva. */
export const usuarioUpdateSchema = z.object({
  estado: z.enum(['ACTIVO', 'BLOQUEADO']).optional(),
  roles: z
    .array(
      z.object({
        rol: z.enum(ROLES),
        sedeId: z.string().uuid().nullable().optional(),
        carreraId: z.string().uuid().nullable().optional(),
      }),
    )
    .min(1, 'Asigne al menos un rol')
    .optional(),
  password: z.string().min(8, 'Mínimo 8 caracteres').optional(),
});
export type UsuarioUpdate = z.infer<typeof usuarioUpdateSchema>;

/** Validación de una solicitud de reserva (R1, R4, R19). `ahora` es inyectable para tests. */
export function reservaCreateSchema(ahora: () => Date = () => new Date()) {
  return z
    .object({
      espacioId: z.string().uuid(),
      inicio: z.coerce.date(),
      fin: z.coerce.date(),
      tipoActividad: codigoCatalogo.default('CLASE'),
      descripcion: z.string().trim().min(3, 'Indique el motivo').max(300),
      asistentes: z.number().int().positive().max(2000),
      /** Serie semanal (D13): se repite el mismo día y horario hasta esta fecha. */
      repetirHasta: z.coerce.date().optional(),
    })
    .superRefine((r, ctx) => {
      const err = (message: string, path: string) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [path] });
      const minutos = (r.fin.getTime() - r.inicio.getTime()) / 60_000;
      if (minutos <= 0) return err('La hora de término debe ser posterior al inicio', 'fin');
      if (minutos < HORARIO.duracionMinMin)
        err(`La duración mínima es ${HORARIO.duracionMinMin} minutos`, 'fin');
      if (minutos > HORARIO.duracionMaxHoras * 60)
        err(`La duración máxima es ${HORARIO.duracionMaxHoras} horas`, 'fin');
      if (r.inicio.getTime() < ahora().getTime()) err('No se puede reservar en el pasado', 'inicio');
      const maxMs = HORARIO.anticipacionMaxDias * 86_400_000;
      if (r.inicio.getTime() - ahora().getTime() > maxMs)
        err(`Solo se puede reservar con ${HORARIO.anticipacionMaxDias} días de anticipación`, 'inicio');
      if (r.inicio.toDateString() !== r.fin.toDateString())
        err('La reserva debe empezar y terminar el mismo día', 'fin');
      if (r.inicio.getDay() === 0) err('No se reserva en domingo', 'inicio');
      if (r.repetirHasta) {
        if (r.repetirHasta <= r.inicio) err('La repetición debe terminar después de la primera fecha', 'repetirHasta');
        if (r.repetirHasta.getTime() - r.inicio.getTime() > 200 * 86_400_000)
          err('Una serie puede durar como máximo un semestre (200 días)', 'repetirHasta');
      }
      const hIni = r.inicio.getHours() + r.inicio.getMinutes() / 60;
      const hFin = r.fin.getHours() + r.fin.getMinutes() / 60;
      if (hIni < HORARIO.aperturaHora || hFin > HORARIO.cierreHora)
        err(
          `Fuera del horario institucional (${HORARIO.aperturaHora}:00–${HORARIO.cierreHora}:00)`,
          'inicio',
        );
    });
}
export type ReservaCreate = z.infer<ReturnType<typeof reservaCreateSchema>>;

export const decisionReservaSchema = z.object({
  comentario: z.string().trim().max(300).optional(),
});
/** Un rechazo exige motivo (restricción aprobacion_rechazo_con_motivo). */
export const rechazoSchema = z.object({
  comentario: z.string({ required_error: 'Indique el motivo del rechazo' }).trim().min(3, 'Indique el motivo del rechazo').max(300),
});
/** Cancelar la reserva de otra persona exige motivo (lo valida también la base, V011). */
export const cancelacionSchema = z.object({
  motivo: z.string().trim().max(300, 'Máximo 300 caracteres').optional(),
});
export const MOTIVO_MINIMO = 5;
export const checkInSchema = z.object({ token: z.string().regex(/^[0-9a-f]{32}$/, 'Código QR inválido') });

export const rangoFechasSchema = z
  .object({ desde: z.coerce.date(), hasta: z.coerce.date(), sedeId: z.string().uuid().optional() })
  .refine((r) => r.hasta > r.desde, { message: '"hasta" debe ser posterior a "desde"', path: ['hasta'] });
export type RangoFechas = z.infer<typeof rangoFechasSchema>;

/**
 * Fila del Excel de planificación semestral (E5 / WBS 1.4.3).
 * Los nombres de columna son provisionales hasta recibir el archivo real del ITN.
 */
export const filaPlanificacionSchema = z.object({
  codigoSala: z.string().trim().min(1),
  asignatura: z.string().trim().min(1),
  docenteRut: rutSchema.optional(),
  diaSemana: z.coerce
    .number({ invalid_type_error: 'Debe ser un número del 1 (lunes) al 6 (sábado)' })
    .int()
    .min(1, 'Debe ser un número del 1 (lunes) al 6 (sábado)')
    .max(6, 'Debe ser un número del 1 (lunes) al 6 (sábado)'),
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  horaFin: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  inscritos: z.coerce
    .number({ invalid_type_error: 'Debe ser un número' })
    .int('Debe ser un número entero')
    .nonnegative('No puede ser negativo'),
});
export type FilaPlanificacion = z.infer<typeof filaPlanificacionSchema>;

export const reporteDanioSchema = z.object({
  espacioId: z.string().uuid(),
  itemId: z.string().uuid().optional(),
  descripcion: z.string().trim().min(5).max(500),
  severidad: z.enum(['BAJA', 'MEDIA', 'ALTA']),
});

export const inspeccionSchema = z.object({
  espacioId: z.string().uuid(),
  observacion: z.string().trim().max(500).optional(),
  items: z
    .array(z.object({ itemId: z.string().uuid(), cantidad: z.number().int().nonnegative() }))
    .min(1),
});
