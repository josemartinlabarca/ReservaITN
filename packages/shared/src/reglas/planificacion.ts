import type { FilaPlanificacion } from '../schemas';
import type { Intervalo } from './choques';

/**
 * Importación de planificación (R9 / WBS 1.4.3): convierte una fila semanal del Excel
 * ("martes 08:30–10:00") en una reserva por cada semana del semestre.
 */
export function expandirSemanal(fila: FilaPlanificacion, desde: Date, hasta: Date): Intervalo[] {
  const [hi, mi] = fila.horaInicio.split(':').map(Number);
  const [hf, mf] = fila.horaFin.split(':').map(Number);
  const dia = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
  // Avanzar hasta el primer día de la semana pedido (1 = lunes … 6 = sábado)
  while (dia.getDay() !== fila.diaSemana) dia.setDate(dia.getDate() + 1);

  const out: Intervalo[] = [];
  for (; dia <= hasta; dia.setDate(dia.getDate() + 7)) {
    const inicio = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), hi, mi);
    const fin = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), hf, mf);
    out.push({ inicio, fin });
  }
  return out;
}

/** Normaliza encabezados del Excel: "Código Sala" → "codigosala". */
export function normalizarEncabezado(h: string): string {
  return h
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Encabezados aceptados por campo. Provisorio hasta recibir el Excel real del ITN:
 * al recibirlo, solo se agregan aquí los nombres de columna que use.
 */
export const COLUMNAS_PLANIFICACION: Record<keyof FilaPlanificacion, string[]> = {
  codigoSala: ['codigosala', 'sala', 'codigo'],
  asignatura: ['asignatura', 'ramo', 'curso'],
  docenteRut: ['docenterut', 'rutdocente', 'rut'],
  diaSemana: ['diasemana', 'dia'],
  horaInicio: ['horainicio', 'inicio', 'desde'],
  horaFin: ['horafin', 'fin', 'hasta', 'horatermino'],
  inscritos: ['inscritos', 'alumnos', 'estudiantes', 'cupo'],
};
