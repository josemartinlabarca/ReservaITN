import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ROLES_AUTOAPROBADOS,
  buscarChoques,
  puedeAprobar,
  siguienteEstado,
  sugerirSalas,
  tienePermiso,
  type AccionReserva,
  type ReservaCreate,
} from '@reservaitn/shared';
import { PrismaService } from '../comun/prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.module';
import type { UsuarioSesion } from '../comun/auth.guard';

const ESTADOS_BLOQUEANTES = ['APROBADA'] as const;

@Injectable()
export class ReservasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notif: NotificacionesService,
  ) {}

  /** Reservas que ocupan salas en un rango (para disponibilidad y sugerencia). */
  ocupaciones(desde: Date, hasta: Date, salaId?: string) {
    return this.prisma.reserva.findMany({
      where: {
        salaId,
        estado: { in: [...ESTADOS_BLOQUEANTES] },
        inicio: { lt: hasta },
        fin: { gt: desde },
      },
      select: { id: true, salaId: true, inicio: true, fin: true, motivo: true, origen: true },
      orderBy: { inicio: 'asc' },
    });
  }

  async solicitar(dto: ReservaCreate, u: UsuarioSesion) {
    const sala = await this.prisma.sala.findUnique({ where: { id: dto.salaId } });
    if (!sala || !sala.activa) throw new NotFoundException('Sala no encontrada');
    if (dto.asistentes > sala.capacidad)
      throw new BadRequestException(`La sala admite ${sala.capacidad} personas`);

    // Validación previa con mensaje claro; la garantía final la da la restricción de BD.
    const choques = buscarChoques(dto, await this.ocupaciones(dto.inicio, dto.fin, dto.salaId));
    if (choques.length) throw new ConflictException('La sala ya está reservada en ese horario');

    const autoaprobada = ROLES_AUTOAPROBADOS.includes(u.rol);
    return this.prisma.$transaction(async (tx) => {
      const reserva = await tx.reserva.create({
        data: {
          ...dto,
          solicitanteId: u.id,
          estado: autoaprobada ? 'APROBADA' : 'PENDIENTE',
          aprobadorId: autoaprobada ? u.id : null,
          decididaEn: autoaprobada ? new Date() : null,
        },
      });
      await tx.eventoReserva.create({
        data: { reservaId: reserva.id, actorId: u.id, accion: 'CREADA', estadoNuevo: reserva.estado },
      });
      if (!autoaprobada) {
        const aprobadores = await this.aprobadoresPara(tx, u.carreraId, sala.carreraExclusivaId);
        await this.notif.notificar(
          tx,
          aprobadores,
          'Nueva solicitud de reserva',
          `${u.nombre} solicita ${sala.codigo} (${dto.inicio.toISOString()})`,
          reserva.id,
        );
      }
      return reserva;
    });
  }

  async decidir(id: string, accion: AccionReserva, u: UsuarioSesion, comentario?: string) {
    const r = await this.prisma.reserva.findUnique({
      where: { id },
      include: { sala: true, solicitante: true },
    });
    if (!r) throw new NotFoundException('Reserva no encontrada');

    const nuevo = siguienteEstado(r.estado, accion);
    if (!nuevo) throw new ConflictException(`No se puede ${accion.toLowerCase()} una reserva ${r.estado}`);
    this.autorizar(accion, r, u);

    return this.prisma.$transaction(async (tx) => {
      // Si hay choque al aprobar, PostgreSQL lanza 23P01 y FiltroErrores responde 409.
      const actualizada = await tx.reserva.update({
        where: { id },
        data: {
          estado: nuevo,
          ...(accion === 'APROBAR' || accion === 'RECHAZAR'
            ? { aprobadorId: u.id, decididaEn: new Date() }
            : {}),
        },
      });
      await tx.eventoReserva.create({
        data: {
          reservaId: id,
          actorId: u.id,
          accion: nuevo,
          estadoAnterior: r.estado,
          estadoNuevo: nuevo,
          comentario,
        },
      });
      await this.notif.notificar(
        tx,
        [r.solicitanteId],
        `Su reserva fue ${nuevo.toLowerCase()}`,
        `${r.sala.codigo}, ${r.inicio.toISOString()}${comentario ? ` — ${comentario}` : ''}`,
        id,
      );
      return actualizada;
    });
  }

  /** Bandeja del aprobador: pendientes que este usuario puede decidir. */
  async pendientes(u: UsuarioSesion) {
    const rs = await this.prisma.reserva.findMany({
      where: { estado: 'PENDIENTE', inicio: { gt: new Date() } },
      include: {
        sala: { select: { codigo: true, carreraExclusivaId: true } },
        solicitante: { select: { nombre: true, rol: true, carreraId: true } },
      },
      orderBy: { inicio: 'asc' },
    });
    return rs.filter((r) =>
      puedeAprobar({
        rolActor: u.rol,
        carreraActor: u.carreraId,
        carreraSolicitante: r.solicitante.carreraId,
        carreraExclusivaSala: r.sala.carreraExclusivaId,
      }),
    );
  }

  historial(id: string) {
    return this.prisma.eventoReserva.findMany({
      where: { reservaId: id },
      include: { actor: { select: { nombre: true, rol: true } } },
      orderBy: { creadoEn: 'asc' },
    });
  }

  async sugerir(params: { inicio: Date; fin: Date; asistentes: number; sedeId?: string; equipamiento?: string[] }, u: UsuarioSesion) {
    const salas = await this.prisma.sala.findMany({ where: { activa: true } });
    const ventanaFin = new Date(params.fin.getTime() + 30 * 60_000);
    const ocup = await this.ocupaciones(params.inicio, ventanaFin);
    return sugerirSalas(
      { ...params, equipamientoRequerido: params.equipamiento, carreraSolicitanteId: u.carreraId },
      salas,
      ocup,
    );
  }

  private autorizar(
    accion: AccionReserva,
    r: { solicitanteId: string; solicitante: { carreraId: string | null }; sala: { carreraExclusivaId: string | null } },
    u: UsuarioSesion,
  ) {
    if (accion === 'APROBAR' || accion === 'RECHAZAR') {
      const ok = puedeAprobar({
        rolActor: u.rol,
        carreraActor: u.carreraId,
        carreraSolicitante: r.solicitante.carreraId,
        carreraExclusivaSala: r.sala.carreraExclusivaId,
      });
      if (!ok) throw new ForbiddenException('No puede decidir sobre esta reserva');
    }
    if (accion === 'CANCELAR') {
      const propia = r.solicitanteId === u.id;
      if (!propia && !tienePermiso(u.rol, 'reserva:cancelar_cualquiera'))
        throw new ForbiddenException('Solo la Subdirección puede cancelar reservas de otros');
    }
    if (accion === 'LIBERAR' && !tienePermiso(u.rol, 'mantencion:planificar'))
      throw new ForbiddenException('Solo operaciones libera reservas no usadas');
  }

  private async aprobadoresPara(
    tx: Pick<PrismaService, 'usuario'>,
    carreraSolicitante: string | null,
    carreraSala: string | null,
  ): Promise<string[]> {
    const carreras = [carreraSolicitante, carreraSala].filter((c): c is string => !!c);
    const us = await tx.usuario.findMany({
      where: {
        activo: true,
        OR: [
          { rol: 'DIRECTOR_CARRERA', carreraId: { in: carreras } },
          ...(carreras.length ? [] : [{ rol: 'DIRECCION_ACADEMICA' as const }]),
        ],
      },
      select: { id: true },
    });
    return us.map((x) => x.id);
  }
}
