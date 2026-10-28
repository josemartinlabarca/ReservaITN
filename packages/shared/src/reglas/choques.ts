/**
 * Detección de choques (R1). Intervalos semiabiertos [inicio, fin):
 * una reserva que termina 10:00 no choca con otra que empieza 10:00.
 * La garantía definitiva está en la BD (restricción EXCLUDE); esto sirve
 * para validar antes de escribir y mostrar mensajes claros al usuario.
 */
export interface Intervalo {
  inicio: Date;
  fin: Date;
}

export function seSolapan(a: Intervalo, b: Intervalo): boolean {
  return a.inicio < b.fin && b.inicio < a.fin;
}

export function buscarChoques<T extends Intervalo>(nueva: Intervalo, existentes: T[]): T[] {
  return existentes.filter((r) => seSolapan(nueva, r));
}
