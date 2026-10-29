import { afterAll, describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { PrismaService } from '../src/comun/prisma.service';
import { ImportacionService } from '../src/importacion/importacion.service';

/** Criterio de aceptación E5: importar el Excel informando cada fila con problema. */
const prisma = new PrismaService();
const svc = new ImportacionService(prisma);
afterAll(() => prisma.$disconnect());

async function excel(filas: unknown[][]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Planificación');
  hoja.addRow(['Código Sala', 'Asignatura', 'Día', 'Hora Inicio', 'Hora Término', 'Inscritos']);
  filas.forEach((f) => hoja.addRow(f));
  return Buffer.from(await libro.xlsx.writeBuffer());
}

describe('importación de planificación', () => {
  it('importa filas válidas e informa errores, choques y salas inexistentes', async () => {
    const t = Date.now();
    const sede = await prisma.sede.create({ data: { nombre: `Sede imp ${t}` } });
    const codigo = `IMP-${t}`;
    await prisma.sala.create({ data: { sedeId: sede.id, codigo, nombre: 'Sala imp', tipo: 'SALA', capacidad: 40 } });
    const u = await prisma.usuario.create({
      data: { rut: `8${t % 10_000_000}-0`, email: `imp${t}@itn.cl`, nombre: 'Operaciones', rol: 'OPERACIONES', passwordHash: 'x' },
    });

    const buffer = await excel([
      [codigo, 'Redes', 2, '08:30', '10:00', 30], // ok: martes
      [codigo, 'Bases de datos', 4, '10:00', '11:30', 25], // ok: jueves
      [codigo, 'Choque', 2, '09:00', '10:30', 20], // choca con Redes
      ['NO-EXISTE', 'Física', 3, '08:00', '09:00', 20], // sala inexistente
      [codigo, 'Hora mala', 3, '8am', '09:00', 20], // formato inválido
    ]);

    const r = await svc.importar(
      { originalname: 'plan.xlsx', buffer },
      new Date(2027, 2, 1),
      new Date(2027, 2, 31),
      { id: u.id, rol: 'OPERACIONES', carreraId: null, nombre: 'Operaciones' },
    );

    expect(r.totalFilas).toBe(5);
    expect(r.filasOk).toBe(2);
    expect(r.reservasCreadas).toBe(5 + 4); // 5 martes + 4 jueves en marzo 2027
    expect(r.errores.map((e) => e.fila)).toEqual([4, 5, 6]);
    expect(r.errores[0].mensaje).toMatch(/Choque/);
    expect(r.errores[1].mensaje).toMatch(/no existe/);
    expect(r.errores[2].mensaje).toMatch(/HH:MM/);
  });

  it('rechaza un Excel sin las columnas obligatorias', async () => {
    const libro = new ExcelJS.Workbook();
    libro.addWorksheet('x').addRow(['Sala', 'Asignatura']);
    const buffer = Buffer.from(await libro.xlsx.writeBuffer());
    await expect(svc.leerExcel(buffer)).rejects.toThrow(/Faltan columnas/);
  });
});
