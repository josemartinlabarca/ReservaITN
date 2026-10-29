import { Controller, Get, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from './comun/prisma.service';
import { UsuariosModule } from './usuarios/usuarios.module';
import { ImportacionModule } from './importacion/importacion.module';
import { SugerenciaModule } from './sugerencia/sugerencia.module';
import { ProyeccionModule } from './proyeccion/proyeccion.module';
import { RecursosModule } from './recursos/recursos.module';
import { ReservasModule } from './reservas/reservas.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { MantencionModule } from './mantencion/mantencion.module';
import { Publico } from './comun/auth.guard';

@Controller('health')
class HealthController {
  @Publico()
  @Get()
  health() {
    return { ok: true, servicio: 'reservaitn-api' };
  }
}

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      signOptions: { expiresIn: '8h' },
    }),
    PrismaModule,
    // Un módulo por paquete de desarrollo de la EDT
    UsuariosModule, // 1.4.1
    RecursosModule, // 1.4.2
    ImportacionModule, // 1.4.3
    ReservasModule, // 1.4.4
    SugerenciaModule, // 1.4.5
    NotificacionesModule, // 1.4.6
    DashboardModule, // 1.4.7
    ProyeccionModule, // 1.4.8
    MantencionModule, // 1.4.10 (1.4.9 es solo cliente móvil)
  ],
  controllers: [HealthController],
})
export class AppModule {}
