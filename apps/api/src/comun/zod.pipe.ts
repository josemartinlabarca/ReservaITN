import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodTypeAny, z } from 'zod';

/** Valida el body/query con los mismos esquemas Zod que usan la web y la app móvil. */
export class ZodPipe<S extends ZodTypeAny> implements PipeTransform<unknown, z.infer<S>> {
  constructor(private readonly schema: S) {}
  transform(value: unknown): z.infer<S> {
    const r = this.schema.safeParse(value);
    if (!r.success) {
      throw new BadRequestException({
        mensaje: 'Datos inválidos',
        errores: r.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
      });
    }
    return r.data;
  }
}
