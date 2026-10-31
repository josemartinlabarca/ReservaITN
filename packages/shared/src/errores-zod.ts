import { z } from 'zod';

/**
 * Mensajes de validación en español para los casos que no tienen mensaje propio.
 * Se registra al importar @reservaitn/shared, así la API, la web y la app muestran lo mismo.
 */
const mapa: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === 'undefined') return { message: 'Campo obligatorio' };
      if (issue.expected === 'number') return { message: 'Debe ser un número' };
      if (issue.expected === 'date') return { message: 'Fecha inválida' };
      return { message: `Tipo inválido: se esperaba ${issue.expected}` };
    case z.ZodIssueCode.invalid_date:
      return { message: 'Fecha inválida' };
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === 'uuid') return { message: 'Identificador inválido' };
      if (issue.validation === 'email') return { message: 'Correo inválido' };
      return { message: 'Formato inválido' };
    case z.ZodIssueCode.invalid_enum_value:
      return { message: `Valor inválido. Opciones: ${issue.options.join(', ')}` };
    case z.ZodIssueCode.too_small:
      if (issue.type === 'string') return { message: `Mínimo ${issue.minimum} caracteres` };
      if (issue.type === 'array') return { message: `Debe tener al menos ${issue.minimum} elemento(s)` };
      return { message: `Debe ser mayor o igual a ${issue.minimum}` };
    case z.ZodIssueCode.too_big:
      if (issue.type === 'string') return { message: `Máximo ${issue.maximum} caracteres` };
      return { message: `Debe ser menor o igual a ${issue.maximum}` };
    default:
      return { message: ctx.defaultError };
  }
};

z.setErrorMap(mapa);
