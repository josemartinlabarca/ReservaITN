import { Injectable, Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../comun/prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.module';

/** Identificador del candado de PostgreSQL: con varias instancias de la API, solo una ejecuta. */
const CANDADO = 72_017_001;

/**
 * Tareas programadas (cada minuto):
 * - vencer las solicitudes pendientes cuyo plazo terminó (D12), que liberan el horario;
 * - liberar las reservas aprobadas sin check-in (R18) y avisar al solicitante.
 * Se desactivan con TAREAS=off (pruebas).
 */
@Injectable()
export class TareasService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Tareas');
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notif: NotificacionesService,
  ) {}

  onModuleInit() {
    if (process.env.TAREAS === 'off') return;
    this.timer = setInterval(() => this.ejecutar().catch((e) => this.log.error(e)), 60_000);
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  async ejecutar() {
    await this.prisma.$transaction(async (tx) => {
      const [{ ok }] = await tx.$queryRaw<{ ok: boolean }[]>`SELECT pg_try_advisory_xact_lock(${CANDADO}) AS ok`;
      if (!ok) return;
      const [{ n }] = await tx.$queryRaw<{ n: number }[]>`SELECT reservas.expirar_pendientes() AS n`;
      const liberadas = await tx.$queryRaw<{ reserva_id: string; solicitante_usuario_id: string }[]>`
        SELECT * FROM reservas.liberar_sin_check_in()`;
      for (const l of liberadas) {
        await this.notif.notificar(
          tx,
          [l.solicitante_usuario_id],
          'RESERVA_LIBERADA',
          'Su reserva se liberó',
          'No se registró check-in a tiempo y el espacio quedó disponible para otros.',
          { reservaId: l.reserva_id },
        );
      }
      if (n || liberadas.length) this.log.log(`Pendientes vencidas: ${n} · Reservas liberadas: ${liberadas.length}`);
    });
  }
}

@Module({ providers: [TareasService], exports: [TareasService] })
export class TareasModule {}
