import { Body, ConflictException, Controller, ForbiddenException, Get, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { espacioCreateSchema, espacioUpdateSchema, tienePermiso, type EspacioCreate, type EspacioUpdate } from '@reservaitn/shared';
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
  activo: true,
  tipo_espacio: { select: { id: true, codigo: true, nombre: true } },
  edificio: { select: { id: true, codigo: true, nombre: true, sede: { select: { id: true, codigo: true, nombre: true } } } },
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

  /** `todos=true` (solo administradores) incluye los espacios desactivados. */
  @Get('espacios')
  espacios(
    @UsuarioActual() u: UsuarioSesion,
    @Query('sedeId') sedeId?: string,
    @Query('tipo') tipo?: string,
    @Query('todos') todos?: string,
  ) {
    if (todos === 'true' && !tienePermiso(u.permisos, 'recurso:gestionar')) throw new ForbiddenException('Sin permiso');
    return this.prisma.espacio.findMany({
      where: {
        ...(todos === 'true' ? {} : { activo: true }),
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

  @Get('carreras')
  carreras() {
    return this.prisma.carrera.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } });
  }

  /**
   * Edita un espacio. `items` reemplaza el equipamiento completo. No se puede desactivar ni dejar
   * de reservar un espacio con reservas futuras activas: primero hay que cancelarlas (R5).
   */
  @RequierePermiso('recurso:gestionar')
  @Patch('espacios/:id')
  async editar(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(espacioUpdateSchema)) dto: EspacioUpdate, @UsuarioActual() u: UsuarioSesion) {
    const actual = await this.prisma.espacio.findUnique({ where: { id } });
    if (!actual) throw new NotFoundException('Espacio no encontrado');
    if (dto.activo === false || dto.reservable === false) {
      const futuras = await this.prisma.reserva.count({
        where: { espacio_id: id, estado: { in: ['PENDIENTE', 'APROBADA'] }, fin: { gt: new Date() } },
      });
      if (futuras > 0)
        throw new ConflictException(`El espacio tiene ${futuras} reserva(s) futura(s). Cancélelas antes de desactivarlo.`);
    }
    return this.prisma.conActor(u.id, async (tx) => {
      if (dto.items) {
        await tx.espacio_item.deleteMany({ where: { espacio_id: id } });
        await tx.espacio_item.createMany({ data: dto.items.map((i) => ({ espacio_id: id, item_id: i.itemId, cantidad_esperada: i.cantidad })) });
      }
      return tx.espacio.update({
        where: { id },
        data: {
          tipo_espacio_id: dto.tipoEspacioId,
          codigo: dto.codigo,
          nombre: dto.nombre,
          piso: dto.piso,
          capacidad: dto.capacidad,
          accesible: dto.accesible,
          reservable: dto.reservable,
          activo: dto.activo,
        },
        select: SELECCION_ESPACIO,
      });
    });
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

export { RecursosController };

@Module({ controllers: [RecursosController] })
export class RecursosModule {}
