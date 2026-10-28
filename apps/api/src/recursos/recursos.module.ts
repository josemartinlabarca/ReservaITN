import { Body, Controller, Get, Module, Post, Query } from '@nestjs/common';
import { salaCreateSchema, type SalaCreate } from '@reservaitn/shared';
import { PrismaService } from '../comun/prisma.service';
import { RequierePermiso } from '../comun/auth.guard';
import { ZodPipe } from '../comun/zod.pipe';

/** Recursos: sedes, salas y laboratorios (E5 / WBS 1.4.2). */
@Controller()
class RecursosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('sedes')
  sedes() {
    return this.prisma.sede.findMany({ orderBy: { nombre: 'asc' } });
  }

  @Get('salas')
  salas(@Query('sedeId') sedeId?: string, @Query('tipo') tipo?: 'SALA' | 'LABORATORIO') {
    return this.prisma.sala.findMany({
      where: { activa: true, sedeId, tipo },
      include: { sede: true, carreraExclusiva: true },
      orderBy: [{ sedeId: 'asc' }, { codigo: 'asc' }],
    });
  }

  @RequierePermiso('recurso:gestionar')
  @Post('salas')
  crear(@Body(new ZodPipe(salaCreateSchema)) dto: SalaCreate) {
    return this.prisma.sala.create({ data: dto });
  }
}

@Module({ controllers: [RecursosController] })
export class RecursosModule {}
