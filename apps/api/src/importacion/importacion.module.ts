import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Module,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import { PrismaService } from '../comun/prisma.service';
import { RequierePermiso, UsuarioActual, type UsuarioSesion } from '../comun/auth.guard';
import { ZodPipe } from '../comun/zod.pipe';
import { ImportacionService } from './importacion.service';

const semestreSchema = z.object({ periodo: z.string().regex(/^[0-9]{4}-[1-3]$/, 'Período con formato 2027-1') });

/** Importación de planificación semestral (R9 / E5 / WBS 1.4.3). */
@Controller('importaciones')
class ImportacionController {
  constructor(
    private readonly svc: ImportacionService,
    private readonly prisma: PrismaService,
  ) {}

  /** multipart/form-data: archivo (.xlsx) y periodo (código, ej. 2027-1). */
  @RequierePermiso('planificacion:importar')
  @Post()
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: 10 * 1024 * 1024 } }))
  importar(
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @Body(new ZodPipe(semestreSchema)) s: z.infer<typeof semestreSchema>,
    @UsuarioActual() u: UsuarioSesion,
  ) {
    if (!archivo) throw new BadRequestException('Adjunte el archivo Excel en el campo "archivo"');
    return this.svc.importar(archivo, s.periodo, u);
  }

  @RequierePermiso('planificacion:importar')
  @Get()
  historial() {
    return this.prisma.$queryRaw`
      SELECT * FROM reservas.v_importacion_resumen ORDER BY creado_en DESC LIMIT 20`;
  }
}

@Module({ controllers: [ImportacionController], providers: [ImportacionService] })
export class ImportacionModule {}
