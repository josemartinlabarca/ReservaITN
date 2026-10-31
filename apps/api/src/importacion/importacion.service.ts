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
  columna: string | null; // null = la fila completa (ej. choque)
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
        datos[campo] = v instanceof Date ? hhmm(v) : typeof v === 'string' ? v.trim() || undefined : (v ?? undefined);
      });
      filas.push({ numero, datos });
    });
    return filas;
  }

  /**
   * Importa la planificación semestral (R9 / E5). Cada fila válida crea una solicitud de origen
   * PLANIFICACION con su patrón semanal y una reserva por semana del período (sin días no hábiles),
   * aprobada automáticamente. Cada fila va en su propia transacción: si una fecha choca, la base
   * rechaza la fila completa (todas sus semanas o ninguna) y se informa sin detener el resto.
   */
  async importar(archivo: { originalname: string; buffer: Buffer }, periodoCodigo: string, u: UsuarioSesion) {
    const periodo = await this.prisma.periodo_academico.findUnique({ where: { codigo: periodoCodigo } });
    if (!periodo) throw new BadRequestException(`El período ${periodoCodigo} no existe`);
    const filas = await this.leerExcel(archivo.buffer);

    const [espacios, clase, noHabiles] = await Promise.all([
      this.prisma.espacio.findMany({ where: { activo: true }, select: { id: true, codigo: true, capacidad: true } }),
      this.prisma.tipo_actividad.findUniqueOrThrow({ where: { codigo: 'CLASE' } }),
      this.prisma.dia_no_habil.findMany({ where: { fecha: { gte: periodo.fecha_inicio, lte: periodo.fecha_fin } } }),
    ]);
    const porCodigo = new Map<string, string[]>();
    for (const e of espacios) porCodigo.set(e.codigo, [...(porCodigo.get(e.codigo) ?? []), e.id]);
    // Los feriados de una sola sede se resuelven por sede en una versión siguiente; aquí se omiten los comunes
    const feriados = new Set(noHabiles.filter((n) => !n.sede_id).map((n) => n.fecha.toISOString().slice(0, 10)));
    const desde = new Date(`${periodo.fecha_inicio.toISOString().slice(0, 10)}T00:00:00`);
    const hasta = new Date(`${periodo.fecha_fin.toISOString().slice(0, 10)}T23:59:59`);

    const importacion = await this.prisma.conActor(u.id, (tx) =>
      tx.importacion.create({
        data: { archivo_nombre: archivo.originalname, periodo_id: periodo.id, usuario_id: u.id, total_filas: filas.length },
      }),
    );

    const errores: ErrorFila[] = [];
    let reservasCreadas = 0;
    for (const { numero, datos } of filas) {
      const v = filaPlanificacionSchema.safeParse(datos);
      if (!v.success) {
        for (const i of v.error.issues) errores.push({ fila: numero, columna: String(i.path[0] ?? ''), mensaje: i.message });
        continue;
      }
      const ids = porCodigo.get(v.data.codigoSala) ?? [];
      if (ids.length !== 1) {
        errores.push({
          fila: numero,
          columna: 'codigoSala',
          mensaje: ids.length ? `El espacio ${v.data.codigoSala} existe en más de un edificio` : `El espacio ${v.data.codigoSala} no existe`,
        });
        continue;
      }
      const ocurrencias = expandirSemanal(v.data, desde, hasta).filter(
        (o) => !feriados.has(o.inicio.toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' })),
      );
      try {
        await this.prisma.conActor(u.id, async (tx) => {
          const [hi, mi] = v.data.horaInicio.split(':').map(Number);
          const [hf, mf] = v.data.horaFin.split(':').map(Number);
          const s = await tx.solicitud.create({
            data: {
              solicitante_usuario_id: u.id,
              tipo_actividad_id: clase.id,
              origen: 'PLANIFICACION',
              importacion_id: importacion.id,
              descripcion: v.data.asignatura,
              asistentes: Math.max(1, v.data.inscritos),
              fecha_desde: periodo.fecha_inicio,
              fecha_hasta: periodo.fecha_fin,
              patron_recurrencia: {
                create: {
                  dia_semana: v.data.diaSemana,
                  hora_inicio: new Date(Date.UTC(1970, 0, 1, hi, mi)),
                  hora_fin: new Date(Date.UTC(1970, 0, 1, hf, mf)),
                },
              },
              reserva: {
                create: ocurrencias.map((o) => ({
                  espacio_id: ids[0],
                  inicio: o.inicio,
                  fin: o.fin,
                  estado: 'PENDIENTE' as const,
                  expira_en: new Date(Date.now() + 3_600_000),
                })),
              },
            },
          });
          // Aprobación automática registrada (N4); el trigger aprueba todas las semanas
          await tx.aprobacion.create({ data: { solicitud_id: s.id, decision: 'APROBADA' } });
        });
        reservasCreadas += ocurrencias.length;
      } catch (e) {
        if (!esChoqueBD(e)) throw e;
        errores.push({ fila: numero, columna: null, mensaje: `Choque de horario en ${v.data.codigoSala} con otra reserva` });
      }
    }

    if (errores.length) {
      await this.prisma.conActor(u.id, (tx) =>
        tx.importacion_error.createMany({
          data: errores.map((e) => ({ importacion_id: importacion.id, fila: e.fila, columna: e.columna, mensaje: e.mensaje })),
          skipDuplicates: true,
        }),
      );
    }
    // N1: las filas correctas se calculan en la vista, no se guardan
    const [resumen] = await this.prisma.$queryRaw<{ filas_ok: number; proporcion_ok: string }[]>`
      SELECT filas_ok, proporcion_ok FROM reservas.v_importacion_resumen WHERE id = ${importacion.id}::uuid`;
    return {
      importacionId: importacion.id,
      totalFilas: filas.length,
      filasOk: resumen.filas_ok,
      reservasCreadas,
      porcentajeOk: Number(resumen.proporcion_ok), // criterio de aceptación E5: ≥ 0,98
      errores,
    };
  }
}

function hhmm(d: Date): string {
  // Excel guarda las horas como fecha 1899-12-30 en UTC
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}
