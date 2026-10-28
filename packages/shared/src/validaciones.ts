/** Valida un RUT chileno con dígito verificador (módulo 11). Acepta "12.345.678-5" o "12345678-5". */
export function rutValido(rut: string): boolean {
  const limpio = rut.replace(/\./g, '').replace(/\s/g, '').toUpperCase();
  const m = /^(\d{7,8})-([\dK])$/.exec(limpio);
  if (!m) return false;
  const [, cuerpo, dv] = m;
  let suma = 0;
  let factor = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  const esperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
  return dv === esperado;
}

/** Normaliza un RUT a "12345678-5". */
export function normalizarRut(rut: string): string {
  return rut.replace(/\./g, '').replace(/\s/g, '').toUpperCase();
}
