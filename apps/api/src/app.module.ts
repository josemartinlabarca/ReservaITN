import { Controller, Get, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from './comun/prisma.service';
import { AuthModule } from './auth/auth.module';
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
    AuthModule,
    NotificacionesModule,
    RecursosModule,
    ReservasModule,
    DashboardModule,
    MantencionModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
