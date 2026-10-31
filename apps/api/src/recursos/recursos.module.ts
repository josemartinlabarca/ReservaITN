import { Body, Controller, Get, Module, Post, Query } from '@nestjs/common';
import { espacioCreateSchema, type EspacioCreate } from '@reservaitn/shared';
import { PrismaService } from '../comun/prisma.service';
import { RequierePermiso, UsuarioActual, type UsuarioSesion } from '../comun/auth.guard';
import { ZodPipe } from '../comun/zod.pipe';

/** Formato común de un espacio para web y móvil. */
export const SELECCION_ESPACIO = {
  id: true,
  codigo: true,
  nombre: true,
  piso: true,
  capacidad: true,
  accesible: true,
  reservable: true,
  tipo_espacio: { select: { codigo: true, nombre: true } },
  edificio: { select: { codigo: true, nombre: true, sede: { select: { id: true, codigo: true, nombre: true } } } },
  espacio_item: { select: { cantidad_esperada: true, item: { select: { id: true, codigo: true, nombre: true, filtrable: true } } } },
  espacio_carrera: { select: { prioridad: true, carrera: { select: { id: true, codigo: true } } } },
} as const;

/** Recursos: sedes, edificios, espacios y catálogos (E5 / WBS 1.4.2). */
@Controller()
class RecursosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('sedes')
  sedes() {
    return this.prisma.sede.findMany({
      where: { activo: true },
      include: { edificio: { where: { activo: true }, orderBy: { codigo: 'asc' } } },
      orderBy: { nombre: 'asc' },
    });
  }

  @Get('espacios')
  espacios(@Query('sedeId') sedeId?: string, @Query('tipo') tipo?: string) {
    return this.prisma.espacio.findMany({
      where: {
        activo: true,
        ...(sedeId ? { edificio: { sede_id: sedeId } } : {}),
        ...(tipo ? { tipo_espacio: { codigo: tipo } } : {}),
      },
      select: SELECCION_ESPACIO,
      orderBy: [{ edificio: { codigo: 'asc' } }, { codigo: 'asc' }],
    });
  }

  @Get('catalogos')
  async catalogos() {
    const [tiposEspacio, tiposActividad, items] = await Promise.all([
      this.prisma.tipo_espacio.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
      this.prisma.tipo_actividad.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
      this.prisma.item.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
    ]);
    return { tiposEspacio, tiposActividad, items };
  }

  @RequierePermiso('recurso:gestionar')
  @Post('espacios')
  crear(@Body(new ZodPipe(espacioCreateSchema)) dto: EspacioCreate, @UsuarioActual() u: UsuarioSesion) {
    return this.prisma.conActor(u.id, (tx) =>
      tx.espacio.create({
        data: {
          edificio_id: dto.edificioId,
          tipo_espacio_id: dto.tipoEspacioId,
          codigo: dto.codigo,
          nombre: dto.nombre,
          piso: dto.piso,
          capacidad: dto.capacidad,
          accesible: dto.accesible,
          espacio_item: { create: dto.items.map((i) => ({ item_id: i.itemId, cantidad_esperada: i.cantidad })) },
        },
        select: SELECCION_ESPACIO,
      }),
    );
  }
}

@Module({ controllers: [RecursosController] })
export class RecursosModule {}
