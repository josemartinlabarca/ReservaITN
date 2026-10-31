import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { tienePermiso, type ReservaCreate } from '@reservaitn/shared';
import { PrismaService, type Tx } from '../comun/prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.module';
import type { UsuarioSesion } from '../comun/auth.guard';

interface Regla {
  id: string;
  accion: 'AUTO_APROBAR' | 'REQUIERE_APROBACION' | 'PROHIBIDO';
}

/** Fecha calendario en Chile ("2026-11-03"), independiente de la zona del servidor. */
const diaChile = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' });
/** Hora del día en Chile como valor para una columna `time` (Prisma la envía en UTC). */
const horaChile = (d: Date) => {
  const [h, m] = d.toLocaleTimeString('sv-SE', { timeZone: 'America/Santiago' }).split(':').map(Number);
  return new Date(Date.UTC(1970, 0, 1, h, m));
};
/** Día ISO 8601 (1 = lunes) en Chile. */
const diaSemanaChile = (d: Date) => ((new Date(`${diaChile(d)}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;

const fmt = (d: Date) =>
  d.toLocaleString('es-CL', { timeZone: 'America/Santiago', dateStyle: 'short', timeStyle: 'short' });

/**
 * Reservas, aprobaciones, cancelación y anti-choques (E6 / WBS 1.4.4).
 * Las reglas críticas las garantiza la base de datos (V006, V010); este servicio orquesta el
 * flujo y produce mensajes claros. Toda escritura pasa por conActor (auditoría con actor).
 */
@Injectable()
export class ReservasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notif: NotificacionesService,
  ) {}

  /** Reservas que ocupan espacios en un rango (pendientes y aprobadas, como la restricción). */
  ocupaciones(desde: Date, hasta: Date, espacioId?: string) {
    return this.prisma.reserva.findMany({
      where: { espacio_id: espacioId, estado: { in: ['PENDIENTE', 'APROBADA'] }, inicio: { lt: hasta }, fin: { gt: desde } },
      select: {
        id: true,
        espacio_id: true,
        inicio: true,
        fin: true,
        estado: true,
        solicitud: { select: { descripcion: true, origen: true, tipo_actividad: { select: { codigo: true } } } },
      },
      orderBy: { inicio: 'asc' },
    });
  }

  /**
   * Crea una solicitud (única o semanal) y sus reservas. Aplica la regla de aprobación (D11):
   * AUTO_APROBAR la aprueba en el acto, REQUIERE_APROBACION la deja pendiente con plazo (D12)
   * y avisa a los aprobadores, PROHIBIDO la rechaza.
   */
  async solicitar(dto: ReservaCreate, u: UsuarioSesion) {
    const espacio = await this.prisma.espacio.findUnique({ where: { id: dto.espacioId } });
    if (!espacio || !espacio.activo || !espacio.reservable) throw new NotFoundException('Espacio no encontrado o no reservable');
    if (dto.asistentes > espacio.capacidad) throw new BadRequestException(`El espacio admite ${espacio.capacidad} personas`);
    const actividad = await this.prisma.tipo_actividad.findUnique({ where: { codigo: dto.tipoActividad } });
    if (!actividad) throw new BadRequestException(`Tipo de actividad desconocido: ${dto.tipoActividad}`);

    const fechas = await this.fechasDeLaSerie(dto, espacio.edificio_id);
    if (!fechas.length) throw new BadRequestException('Todas las fechas de la serie caen en días no hábiles');

    return this.prisma.conActor(u.id, async (tx) => {
      // Primero se liberan las pendientes vencidas de este espacio (D12: vencimiento exacto)
      await tx.$queryRaw`SELECT reservas.expirar_pendientes(${dto.espacioId}::uuid)`;

      const [regla] = await tx.$queryRaw<Regla[]>`
        SELECT id, accion::text AS accion
          FROM reservas.regla_aplicable(${u.id}::uuid, ${dto.espacioId}::uuid, ${actividad.id}::uuid)`;
      if (!regla?.accion || regla.accion === 'PROHIBIDO') {
        throw new ForbiddenException('Su rol no puede reservar este tipo de espacio');
      }

      const [plazo] = await tx.$queryRaw<{ minutos: number }[]>`
        SELECT valor::int AS minutos FROM institucion.parametro WHERE clave = 'reserva.minutos_bloqueo_pendiente'`;
      const expira = new Date(Date.now() + (plazo?.minutos ?? 1440) * 60_000);
      const serie = dto.repetirHasta !== undefined;

      const solicitud = await tx.solicitud.create({
        data: {
          solicitante_usuario_id: u.id,
          tipo_actividad_id: actividad.id,
          descripcion: dto.descripcion,
          asistentes: dto.asistentes,
          fecha_desde: serie ? new Date(diaChile(dto.inicio)) : null,
          fecha_hasta: serie ? new Date(dto.repetirHasta!.toISOString().slice(0, 10)) : null,
          patron_recurrencia: serie
            ? { create: { dia_semana: diaSemanaChile(dto.inicio), hora_inicio: horaChile(dto.inicio), hora_fin: horaChile(dto.fin) } }
            : undefined,
          reserva: {
            create: fechas.map((f) => ({ espacio_id: dto.espacioId, inicio: f.inicio, fin: f.fin, estado: 'PENDIENTE' as const, expira_en: expira })),
          },
        },
      });

      if (regla.accion === 'AUTO_APROBAR') {
        // N4: la aprobación automática también deja registro (sin persona responsable)
        await tx.aprobacion.create({ data: { solicitud_id: solicitud.id, regla_aprobacion_id: regla.id, decision: 'APROBADA' } });
      } else {
        const aprobadores = await tx.$queryRaw<{ id: string }[]>`SELECT reservas.aprobadores_de(${solicitud.id}::uuid) AS id`;
        await this.notif.notificar(
          tx,
          aprobadores.map((a) => a.id),
          'SOLICITUD_CREADA',
          'Nueva solicitud de reserva',
          `${u.nombre} solicita ${espacio.codigo} el ${fmt(dto.inicio)}${serie ? ` (${fechas.length} fechas)` : ''}: ${dto.descripcion}`,
          { solicitudId: solicitud.id },
        );
      }
      return this.detalleSolicitud(tx, solicitud.id);
    });
  }

  /** Bandeja del aprobador: solicitudes pendientes que este usuario puede decidir (reservas.puede_aprobar). */
  async pendientes(u: UsuarioSesion) {
    const ids = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT DISTINCT s.id
        FROM reservas.solicitud s
        JOIN reservas.reserva r ON r.solicitud_id = s.id AND r.estado = 'PENDIENTE' AND r.expira_en > now()
        LEFT JOIN reservas.aprobacion a ON a.solicitud_id = s.id
       WHERE a.id IS NULL
         AND reservas.puede_aprobar(${u.id}::uuid, s.id)`;
    return Promise.all(ids.map((x) => this.detalleSolicitud(this.prisma, x.id)));
  }

  /** Aprueba o rechaza una solicitud completa (una serie se decide de una vez, D14). */
  async decidir(solicitudId: string, decision: 'APROBADA' | 'RECHAZADA', u: UsuarioSesion, comentario?: string) {
    return this.prisma.conActor(u.id, async (tx) => {
      const solicitud = await tx.solicitud.findUnique({ where: { id: solicitudId }, include: { aprobacion: true } });
      if (!solicitud) throw new NotFoundException('Solicitud no encontrada');
      if (solicitud.aprobacion) throw new ConflictException('La solicitud ya fue decidida');
      const [{ puede }] = await tx.$queryRaw<{ puede: boolean }[]>`
        SELECT reservas.puede_aprobar(${u.id}::uuid, ${solicitudId}::uuid) AS puede`;
      if (!puede) throw new ForbiddenException('No le corresponde decidir esta solicitud');

      const primera = await tx.reserva.findFirst({ where: { solicitud_id: solicitudId }, orderBy: { inicio: 'asc' } });
      const [regla] = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM reservas.regla_aplicable(${solicitud.solicitante_usuario_id}::uuid, ${primera!.espacio_id}::uuid, ${solicitud.tipo_actividad_id}::uuid)`;
      // El trigger aprobacion_aplica_a_reservas actualiza las reservas pendientes
      await tx.aprobacion.create({
        data: { solicitud_id: solicitudId, regla_aprobacion_id: regla?.id, decision, decidido_por_usuario_id: u.id, comentario },
      });
      await this.notif.notificar(
        tx,
        [solicitud.solicitante_usuario_id],
        decision === 'APROBADA' ? 'SOLICITUD_APROBADA' : 'SOLICITUD_RECHAZADA',
        decision === 'APROBADA' ? 'Su solicitud fue aprobada' : 'Su solicitud fue rechazada',
        `${solicitud.descripcion}${comentario ? ` — ${comentario}` : ''}`,
        { solicitudId },
      );
      return this.detalleSolicitud(tx, solicitudId);
    });
  }

  /** Cancela una reserva (una fecha de la serie). Propia, o cualquiera con el permiso de Subdirección (R5). */
  async cancelar(reservaId: string, u: UsuarioSesion, comentario?: string) {
    return this.prisma.conActor(u.id, async (tx) => {
      const r = await tx.reserva.findUnique({ where: { id: reservaId }, include: { solicitud: true, espacio: true } });
      if (!r) throw new NotFoundException('Reserva no encontrada');
      const propia = r.solicitud.solicitante_usuario_id === u.id;
      if (!propia && !tienePermiso(u.permisos, 'reserva:cancelar_cualquiera'))
        throw new ForbiddenException('Solo la Subdirección puede cancelar reservas de otros');
      // El trigger reserva_transicion_valida rechaza estados que no se pueden cancelar
      const actualizada = await tx.reserva.update({ where: { id: reservaId }, data: { estado: 'CANCELADA' } });
      if (!propia) {
        await this.notif.notificar(
          tx,
          [r.solicitud.solicitante_usuario_id],
          'RESERVA_CANCELADA',
          'Su reserva fue cancelada',
          `${r.espacio.codigo}, ${fmt(r.inicio)}${comentario ? ` — ${comentario}` : ''}`,
          { reservaId },
        );
      }
      return actualizada;
    });
  }

  /** Check-in con el código QR del espacio (D15): marca la reserva aprobada en curso del usuario. */
  async checkIn(token: string, u: UsuarioSesion) {
    const espacio = await this.prisma.espacio.findUnique({ where: { token_qr: token } });
    if (!espacio) throw new NotFoundException('Código QR no reconocido');
    const r = await this.prisma.reserva.findFirst({
      where: {
        espacio_id: espacio.id,
        estado: 'APROBADA',
        solicitud: { solicitante_usuario_id: u.id },
        fin: { gt: new Date() },
        inicio: { lte: new Date(Date.now() + 15 * 60_000) },
        check_in: null,
      },
      orderBy: { inicio: 'asc' },
    });
    if (!r) throw new NotFoundException(`No tiene una reserva aprobada en curso en ${espacio.codigo}`);
    // El trigger check_in_valido vuelve a validar estado y horario
    return this.prisma.conActor(u.id, (tx) =>
      tx.check_in.create({ data: { reserva_id: r.id, usuario_id: u.id, metodo: 'QR' } }),
    );
  }

  mias(u: UsuarioSesion) {
    return this.prisma.reserva.findMany({
      where: { solicitud: { solicitante_usuario_id: u.id }, fin: { gt: new Date(Date.now() - 7 * 86_400_000) } },
      select: {
        id: true,
        inicio: true,
        fin: true,
        estado: true,
        expira_en: true,
        espacio: { select: { codigo: true, nombre: true } },
        solicitud: { select: { id: true, descripcion: true } },
        check_in: { select: { registrado_en: true } },
      },
      orderBy: { inicio: 'asc' },
    });
  }

  /** Trazabilidad (R7): vista + bitácora de auditoría de la reserva. */
  async historial(reservaId: string) {
    // Prisma no lee columnas interval: el tiempo de aprobación se entrega en horas
    const [traza] = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT reserva_id, inicio, fin, estado::text, espacio, sede_id, solicitud_id, origen::text,
             tipo_actividad, asistentes, solicitante_usuario_id, solicitado_en,
             decision::text, decidido_por_usuario_id, decidido_en,
             extract(epoch FROM tiempo_aprobacion)::float / 3600 AS horas_aprobacion
        FROM reservas.v_reserva_trazabilidad WHERE reserva_id = ${reservaId}::uuid`;
    if (!traza) throw new NotFoundException('Reserva no encontrada');
    const eventos = await this.prisma.evento.findMany({
      where: { tabla: 'reserva', registro_id: reservaId },
      select: { operacion: true, actor_usuario_id: true, ocurrido_en: true, datos_despues: true },
      orderBy: { id: 'asc' },
    });
    return { ...traza, eventos };
  }

  /** Fechas de la reserva o de la serie semanal, omitiendo los días no hábiles de la sede (D13). */
  private async fechasDeLaSerie(dto: ReservaCreate, edificioId: string) {
    // `repetirHasta` llega como fecha sin hora: se compara como día calendario, incluido
    const ultimoDia = dto.repetirHasta ? dto.repetirHasta.toISOString().slice(0, 10) : diaChile(dto.inicio);
    const fechas: { inicio: Date; fin: Date }[] = [];
    // Se suman días de calendario en hora local (el proceso corre con TZ=America/Santiago, ver main.ts):
    // sumar 7 × 24 h en milisegundos correría la clase una hora en el cambio de horario de Chile.
    const masSemanas = (d: Date, n: number) => {
      const r = new Date(d);
      r.setDate(r.getDate() + 7 * n);
      return r;
    };
    for (let semana = 0; ; semana++) {
      const inicio = masSemanas(dto.inicio, semana);
      if (diaChile(inicio) > ultimoDia) break;
      fechas.push({ inicio, fin: masSemanas(dto.fin, semana) });
    }
    const edificio = await this.prisma.edificio.findUniqueOrThrow({ where: { id: edificioId } });
    const noHabiles = await this.prisma.dia_no_habil.findMany({
      where: {
        OR: [{ sede_id: null }, { sede_id: edificio.sede_id }],
        fecha: { gte: new Date(diaChile(dto.inicio)), lte: new Date(ultimoDia) },
      },
    });
    const excluidas = new Set(noHabiles.map((n) => n.fecha.toISOString().slice(0, 10)));
    return fechas.filter((f) => !excluidas.has(diaChile(f.inicio)));
  }

  private detalleSolicitud(db: Tx | PrismaService, id: string) {
    return db.solicitud.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        descripcion: true,
        asistentes: true,
        origen: true,
        creado_en: true,
        fecha_desde: true,
        fecha_hasta: true,
        tipo_actividad: { select: { codigo: true, nombre: true } },
        usuario: { select: { id: true, persona: { select: { nombres: true, apellido_paterno: true } } } },
        aprobacion: { select: { decision: true, decidido_en: true, comentario: true, decidido_por_usuario_id: true } },
        reserva: {
          select: { id: true, inicio: true, fin: true, estado: true, expira_en: true, espacio: { select: { id: true, codigo: true } } },
          orderBy: { inicio: 'asc' },
        },
      },
    });
  }
}
