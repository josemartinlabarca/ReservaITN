// Las reglas de horario (08:00–23:00, jornadas) se evalúan en hora de Chile, aunque el servidor esté en UTC.
process.env.TZ ??= 'America/Santiago';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { FiltroErrores } from './comun/filtro-errores';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true });
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new FiltroErrores());
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  console.log(`ReservaITN API escuchando en http://localhost:${port}/api`);
}
bootstrap();
