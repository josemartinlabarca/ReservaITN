import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import {
  COLUMNAS_PLANIFICACION,
  expandirSemanal,
  filaPlanificacionSchema,
  normalizarEncabezado,
  type FilaPlanificacion,
} from '@reservaitn/shared';
import { PrismaService } from '../comun/prisma.service';
import { esChoqueBD } from '../comun/filtro-errores';
import type { UsuarioSesion } from '../comun/auth.guard';

export interface ErrorFila {
  fila: number;
  mensaje: string;
}

@Injectable()
export class ImportacionService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lee la primera hoja: la fila 1 son encabezados; devuelve objetos con las claves de FilaPlanificacion. */
  async leerExcel(buffer: Buffer): Promise<{ numero: number; datos: Record<string, unknown> }[]> {
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(buffer as unknown as ArrayBuffer);
    const hoja = libro.worksheets[0];
    if (!hoja) throw new BadRequestException('El archivo no tiene hojas');

    const columnas = new Map<number, keyof FilaPlanificacion>();
    hoja.getRow(1).eachCell((celda, col) => {
      const h = normalizarEncabezado(String(celda.value ?? ''));
      const campo = (Object.keys(COLUMNAS_PLANIFICACION) as (keyof FilaPlanificacion)[]).find((k) =>
        COLUMNAS_PLANIFICACION[k].includes(h),
      );
      if (campo) columnas.set(col, campo);
    });
    const faltantes = (['codigoSala', 'asignatura', 'diaSemana', 'horaInicio', 'horaFin', 'inscritos'] as const)
      .filter((c) => ![...columnas.values()].includes(c));
    if (faltantes.length) throw new BadRequestException(`Faltan columnas en el Excel: ${faltantes.join(', ')}`);

    const filas: { numero: number; datos: Record<string, unknown> }[] = [];
    hoja.eachRow((row, numero) => {
      if (numero === 1) return;
      const datos: Record<string, unknown> = {};
      columnas.forEach((campo, col) => {
        const v = row.getCell(col).value;
        datos[campo] = v instanceof Date ? hhmm(v) : typeof v === 'string' ? v.trim() || undefined : v ?? undefined;
      });
      filas.push({ numero, datos });
    });
    return filas;
  }

  /**
   * Importa la planificación semestral (R9 / E5). Cada fila válida genera una reserva APROBADA
   * de origen PLANIFICACION por semana. Una fila con choque o error se informa y no detiene el resto.
   */
  async importar(archivo: { originalname: string; buffer: Buffer }, desde: Date, hasta: Date, u: UsuarioSesion) {
    const filas = await this.leerExcel(archivo.buffer);
    const salas = await this.prisma.sala.findMany({ where: { activa: true }, select: { id: true, codigo: true } });
    const salaPorCodigo = new Map<string, string[]>();
    for (const s of salas) salaPorCodigo.set(s.codigo, [...(salaPorCodigo.get(s.codigo) ?? []), s.id]);

    const importacion = await this.prisma.importacion.create({
      data: { archivoNombre: archivo.originalname, usuarioId: u.id, totalFilas: filas.length, filasOk: 0 },
    });

    const errores: ErrorFila[] = [];
    let filasOk = 0;
    let reservasCreadas = 0;
    for (const { numero, datos } of filas) {
      const v = filaPlanificacionSchema.safeParse(datos);
      if (!v.success) {
        errores.push({ fila: numero, mensaje: v.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
        continue;
      }
      const ids = salaPorCodigo.get(v.data.codigoSala) ?? [];
      if (ids.length !== 1) {
        errores.push({ fila: numero, mensaje: ids.length ? `Sala ${v.data.codigoSala} existe en más de una sede` : `Sala ${v.data.codigoSala} no existe` });
        continue;
      }
      const ocurrencias = expandirSemanal(v.data, desde, hasta);
      try {
        // Todas las semanas de la fila o ninguna: si una choca, la BD rechaza la fila completa.
        await this.prisma.reserva.createMany({
          data: ocurrencias.map((o) => ({
            ...o,
            salaId: ids[0],
            solicitanteId: u.id,
            aprobadorId: u.id,
            decididaEn: new Date(),
            estado: 'APROBADA' as const,
            origen: 'PLANIFICACION' as const,
            motivo: v.data.asignatura,
            asistentes: Math.max(1, v.data.inscritos),
            importacionId: importacion.id,
          })),
        });
        filasOk++;
        reservasCreadas += ocurrencias.length;
      } catch (e) {
        if (!esChoqueBD(e)) throw e;
        errores.push({ fila: numero, mensaje: `Choque de horario en ${v.data.codigoSala} con otra reserva aprobada` });
      }
    }

    await this.prisma.importacion.update({
      where: { id: importacion.id },
      data: { filasOk, errores: errores as unknown as object },
    });
    return {
      importacionId: importacion.id,
      totalFilas: filas.length,
      filasOk,
      reservasCreadas,
      // Criterio de aceptación E5: ≥ 98 %
      porcentajeOk: filas.length ? filasOk / filas.length : 0,
      errores,
    };
  }
}

function hhmm(d: Date): string {
  // Excel guarda las horas como fecha 1899-12-30 en UTC
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}
