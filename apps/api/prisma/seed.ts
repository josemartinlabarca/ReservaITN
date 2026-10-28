/* Datos de ejemplo para desarrollo. Reemplazar por la carga real del Excel (E14 / WBS 1.6.3). */
import { PrismaClient, type Rol } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const pass = await bcrypt.hash('reservaitn', 10);
  const sede1 = await prisma.sede.upsert({ where: { nombre: 'Sede Centro' }, update: {}, create: { nombre: 'Sede Centro' } });
  const sede2 = await prisma.sede.upsert({ where: { nombre: 'Sede Norte' }, update: {}, create: { nombre: 'Sede Norte' } });
  const inf = await prisma.carrera.upsert({ where: { codigo: 'INF' }, update: {}, create: { codigo: 'INF', nombre: 'Técnico en Informática' } });
  const enf = await prisma.carrera.upsert({ where: { codigo: 'ENF' }, update: {}, create: { codigo: 'ENF', nombre: 'Técnico en Enfermería' } });

  const usuarios: [string, string, string, Rol, string | null][] = [
    ['11111111-1', 'subdireccion@itn.cl', 'Pedro Fernández', 'SUBDIRECCION', null],
    ['22222222-2', 'datd@itn.cl', 'Francisca Urrutia Villablanca', 'DATD', null],
    ['33333333-3', 'academica@itn.cl', 'Dirección Académica', 'DIRECCION_ACADEMICA', null],
    ['44444444-4', 'dir.inf@itn.cl', 'Director Informática', 'DIRECTOR_CARRERA', inf.id],
    ['55555555-5', 'docente@itn.cl', 'Docente Demo', 'DOCENTE', inf.id],
    ['66666666-6', 'estudiante@itn.cl', 'Estudiante Demo', 'ESTUDIANTE', inf.id],
    ['77777777-7', 'operaciones@itn.cl', 'Encargado de Operaciones', 'OPERACIONES', null],
    ['88888888-8', 'aseo@itn.cl', 'Personal de Aseo', 'ASEO_MANTENCION', null],
  ];
  for (const [rut, email, nombre, rol, carreraId] of usuarios) {
    await prisma.usuario.upsert({ where: { email }, update: {}, create: { rut, email, nombre, rol, carreraId, passwordHash: pass } });
  }

  const salas = [
    { sedeId: sede1.id, codigo: 'A-101', nombre: 'Sala A-101', tipo: 'SALA' as const, capacidad: 40, equipamiento: ['proyector'] },
    { sedeId: sede1.id, codigo: 'A-102', nombre: 'Sala A-102', tipo: 'SALA' as const, capacidad: 30, equipamiento: ['proyector'] },
    { sedeId: sede1.id, codigo: 'LAB-INF1', nombre: 'Laboratorio Informática 1', tipo: 'LABORATORIO' as const, capacidad: 25, equipamiento: ['computadores', 'proyector'], carreraExclusivaId: inf.id },
    { sedeId: sede2.id, codigo: 'B-201', nombre: 'Sala B-201', tipo: 'SALA' as const, capacidad: 50, equipamiento: [] },
    { sedeId: sede2.id, codigo: 'LAB-ENF', nombre: 'Laboratorio Enfermería', tipo: 'LABORATORIO' as const, capacidad: 20, equipamiento: ['camillas'], carreraExclusivaId: enf.id },
  ];
  for (const s of salas) {
    await prisma.sala.upsert({ where: { sedeId_codigo: { sedeId: s.sedeId, codigo: s.codigo } }, update: {}, create: s });
  }
  console.log('Seed listo. Usuarios demo con contraseña "reservaitn".');
}

main().finally(() => prisma.$disconnect());
