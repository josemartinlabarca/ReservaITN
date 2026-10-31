import { afterAll, describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { ImportacionService } from '../src/importacion/importacion.service';
import { prisma, sesion } from './ayuda';

/** Criterio de aceptación E5: importar el Excel informando cada fila con problema. */
const svc = new ImportacionService(prisma);
afterAll(() => prisma.$disconnect());

async function excel(filas: unknown[][]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Planificación');
  hoja.addRow(['Código Sala', 'Asignatura', 'Día', 'Hora Inicio', 'Hora Término', 'Inscritos']);
  filas.forEach((f) => hoja.addRow(f));
  return Buffer.from(await libro.xlsx.writeBuffer());
}

describe('importación de planificación (R9)', () => {
  it('importa filas válidas, omite feriados e informa errores, choques y espacios inexistentes', async () => {
    // Período y espacio propios de esta corrida (los períodos no pueden solaparse)
    const anio = 2100 + Math.floor(Math.random() * 800);
    const periodo = await prisma.periodo_academico.create({
      data: { codigo: `${anio}-1`, nombre: 'Prueba', fecha_inicio: new Date(`${anio}-03-01`), fecha_fin: new Date(`${anio}-03-31`) },
    });
    const edificio = await prisma.edificio.findFirstOrThrow({ where: { codigo: 'A' } });
    const tipo = await prisma.tipo_espacio.findUniqueOrThrow({ where: { codigo: 'SALA' } });
    const codigo = `IMP-${anio}`;
    await prisma.espacio.create({ data: { edificio_id: edificio.id, tipo_espacio_id: tipo.id, codigo, nombre: 'Sala de importación', capacidad: 40 } });
    const operaciones = await sesion('operaciones@itn.cl');

    const r = await svc.importar(
      {
        originalname: 'plan.xlsx',
        buffer: await excel([
          [codigo, 'Redes', 2, '08:30', '10:00', 30], // ok: martes
          [codigo, 'Bases de datos', 4, '10:00', '11:30', 25], // ok: jueves
          [codigo, 'Choque', 2, '09:00', '10:30', 20], // choca con Redes
          ['NO-EXISTE', 'Física', 3, '08:00', '09:00', 20],
          [codigo, 'Hora mala', 3, '8am', '09:00', 20],
        ]),
      },
      periodo.codigo,
      operaciones,
    );

    const martes = [...Array(31).keys()].map((d) => new Date(anio, 2, d + 1)).filter((d) => d.getDay() === 2).length;
    const jueves = [...Array(31).keys()].map((d) => new Date(anio, 2, d + 1)).filter((d) => d.getDay() === 4).length;
    expect(r).toMatchObject({ totalFilas: 5, filasOk: 2, reservasCreadas: martes + jueves, porcentajeOk: 0.4 });
    expect(r.errores.map((e) => [e.fila, e.columna])).toEqual([
      [4, null],
      [5, 'codigoSala'],
      [6, 'horaInicio'],
    ]);
    expect(await prisma.importacion_error.count({ where: { importacion_id: r.importacionId } })).toBe(3);

    // Todas las clases importadas quedan aprobadas y con aprobación automática registrada
    const estados = await prisma.reserva.groupBy({
      by: ['estado'],
      where: { solicitud: { importacion_id: r.importacionId } },
      _count: true,
    });
    expect(estados).toEqual([{ estado: 'APROBADA', _count: martes + jueves }]);
  });

  it('rechaza un Excel sin las columnas obligatorias', async () => {
    const libro = new ExcelJS.Workbook();
    libro.addWorksheet('x').addRow(['Sala', 'Asignatura']);
    await expect(svc.leerExcel(Buffer.from(await libro.xlsx.writeBuffer()))).rejects.toThrow(/Faltan columnas/);
  });
});
