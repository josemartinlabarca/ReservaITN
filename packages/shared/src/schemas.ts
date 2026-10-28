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
  'LIBERADA',
] as const;
export type EstadoReserva = (typeof ESTADOS_RESERVA)[number];

export const TIPOS_RECURSO = ['SALA', 'LABORATORIO'] as const;
export const ORIGENES_RESERVA = ['SOLICITUD', 'PLANIFICACION', 'MANTENCION'] as const;

export const rutSchema = z
  .string()
  .transform(normalizarRut)
  .refine(rutValido, { message: 'RUT inválido' });

export const usuarioCreateSchema = z.object({
  rut: rutSchema,
  email: z.string().email('Correo inválido').toLowerCase(),
  nombre: z.string().trim().min(3).max(120),
  rol: z.enum(ROLES),
  carreraId: z.string().uuid().optional(),
});
export type UsuarioCreate = z.infer<typeof usuarioCreateSchema>;

export const salaCreateSchema = z.object({
  codigo: z.string().trim().min(1).max(20),
  nombre: z.string().trim().min(2).max(80),
  tipo: z.enum(TIPOS_RECURSO),
  sedeId: z.string().uuid(),
  capacidad: z.number().int().positive().max(500),
  equipamiento: z.array(z.string().trim().min(1)).default([]),
  carreraExclusivaId: z.string().uuid().nullable().optional(),
});
export type SalaCreate = z.infer<typeof salaCreateSchema>;

/** Validación de una solicitud de reserva (R1, R4, R19). `ahora` es inyectable para tests. */
export function reservaCreateSchema(ahora: () => Date = () => new Date()) {
  return z
    .object({
      salaId: z.string().uuid(),
      inicio: z.coerce.date(),
      fin: z.coerce.date(),
      motivo: z.string().trim().min(3, 'Indique el motivo').max(300),
      asistentes: z.number().int().positive().max(500),
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
  diaSemana: z.coerce.number().int().min(1).max(6), // 1 = lunes … 6 = sábado
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  horaFin: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  inscritos: z.coerce.number().int().nonnegative(),
});
export type FilaPlanificacion = z.infer<typeof filaPlanificacionSchema>;

export const reporteDanioSchema = z.object({
  salaId: z.string().uuid(),
  descripcion: z.string().trim().min(5).max(500),
  severidad: z.enum(['BAJA', 'MEDIA', 'ALTA']),
  fotoUrl: z.string().url().optional(),
});

export const conteoInventarioSchema = z.object({
  salaId: z.string().uuid(),
  items: z
    .array(z.object({ itemId: z.string().uuid(), cantidad: z.number().int().nonnegative() }))
    .min(1),
});
