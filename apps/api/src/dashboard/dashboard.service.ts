import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { HORARIO, horasOcupadas, indiceOcupacion, type RangoFechas } from '@reservaitn/shared';
import { PrismaService } from '../comun/prisma.service';

/** Días hábiles (lun–sáb) en el rango × horas del horario institucional. */
export function horasDisponiblesPorSala(desde: Date, hasta: Date): number {
  const horasDia = HORARIO.cierreHora - HORARIO.aperturaHora;
  let dias = 0;
  for (let d = new Date(desde); d < hasta; d.setDate(d.getDate() + 1)) if (d.getDay() !== 0) dias++;
  return dias * horasDia;
}

export interface FilaEspacio {
  espacioId: string;
  codigo: string;
  nombre: string;
  sede: string;
  tipo: string;
  capacidad: number;
  horasReservadas: number;
  horasDisponibles: number;
  indice: number;
}

export interface FilaReserva {
  reservaId: string;
  inicio: Date;
  fin: Date;
  estado: string;
  espacio: string;
  sede: string;
  tipoActividad: string;
  origen: string;
  asistentes: number;
  descripcion: string;
  solicitadoEn: Date;
  solicitante: string;
  aprobador: string | null;
  aprobacionAutomatica: boolean;
  horasAprobacion: number | null;
  canceladoPor: string | null;
  canceladoEn: Date | null;
  motivoCancelacion: string | null;
}

/**
 * Cálculos del dashboard y de los reportes (E9 / WBS 1.4.7). La pantalla y el Excel usan este
 * mismo servicio, así ambos muestran exactamente los mismos números.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /** Reservas aprobadas de uso real (la mantención no cuenta como uso, B3). */
  reservasAprobadas(q: RangoFechas, espacioIds?: string[]) {
    return this.prisma.reserva.findMany({
      where: {
        estado: 'APROBADA',
        solicitud: { origen: { not: 'MANTENCION' } },
        inicio: { lt: q.hasta },
        fin: { gt: q.desde },
        ...(espacioIds ? { espacio_id: { in: espacioIds } } : {}),
        ...(q.sedeId ? { espacio: { edificio: { sede_id: q.sedeId } } } : {}),
      },
      select: { espacio_id: true, inicio: true, fin: true },
    });
  }

  async ocupacion(q: RangoFechas) {
    const espacios = await this.prisma.espacio.findMany({
      where: { activo: true, reservable: true, ...(q.sedeId ? { edificio: { sede_id: q.sedeId } } : {}) },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        capacidad: true,
        tipo_espacio: { select: { nombre: true } },
        edificio: { select: { sede: { select: { nombre: true } } } },
      },
    });
    const reservas = await this.reservasAprobadas(q, espacios.map((e) => e.id));
    const rango = { inicio: q.desde, fin: q.hasta };
    const disponibles = horasDisponiblesPorSala(q.desde, q.hasta);

    const porEspacio: FilaEspacio[] = espacios
      .map((e) => {
        const horas = horasOcupadas(reservas.filter((r) => r.espacio_id === e.id), rango);
        return {
          espacioId: e.id,
          codigo: e.codigo,
          nombre: e.nombre,
          sede: e.edificio.sede.nombre,
          tipo: e.tipo_espacio.nombre,
          capacidad: e.capacidad,
          horasReservadas: Math.round(horas * 10) / 10,
          horasDisponibles: disponibles,
          indice: indiceOcupacion(horas, disponibles),
        };
      })
      .sort((a, b) => b.indice - a.indice || a.codigo.localeCompare(b.codigo));

    const total = porEspacio.reduce((acc, s) => acc + s.horasReservadas, 0);
    return {
      rango: { desde: q.desde, hasta: q.hasta },
      indiceGlobal: indiceOcupacion(total, disponibles * espacios.length),
      totalReservas: reservas.length,
      porEspacio,
      reservas,
    };
  }

  /** Indicadores del Plan de Gestión de Beneficios, calculados desde la vista de trazabilidad. */
  async indicadores(q: RangoFechas) {
    const [r] = await this.prisma.$queryRaw<
      {
        total: bigint;
        pendientes: bigint;
        aprobadas: bigint;
        rechazadas: bigint;
        canceladas: bigint;
        liberadas: bigint;
        expiradas: bigint;
        horas_aprobacion: number | null;
      }[]
    >`
      SELECT count(*)                                         AS total,
             count(*) FILTER (WHERE estado = 'PENDIENTE')     AS pendientes,
             count(*) FILTER (WHERE estado = 'APROBADA')      AS aprobadas,
             count(*) FILTER (WHERE estado = 'RECHAZADA')     AS rechazadas,
             count(*) FILTER (WHERE estado = 'CANCELADA')     AS canceladas,
             count(*) FILTER (WHERE estado = 'LIBERADA')      AS liberadas,
             count(*) FILTER (WHERE estado = 'EXPIRADA')      AS expiradas,
             avg(extract(epoch FROM tiempo_aprobacion) / 3600)
               FILTER (WHERE origen = 'SOLICITUD' AND decidido_por_usuario_id IS NOT NULL) AS horas_aprobacion
        FROM reservas.v_reserva_trazabilidad
       WHERE inicio < ${q.hasta} AND fin > ${q.desde}
         ${q.sedeId ? Prisma.sql`AND sede_id = ${q.sedeId}::uuid` : Prisma.empty}`;
    const n = (x: bigint) => Number(x);
    const confirmadas = n(r.aprobadas) + n(r.liberadas);
    return {
      totalReservas: n(r.total),
      pendientes: n(r.pendientes),
      aprobadas: n(r.aprobadas),
      rechazadas: n(r.rechazadas),
      canceladas: n(r.canceladas),
      liberadas: n(r.liberadas),
      expiradas: n(r.expiradas),
      // B3: reservas no usadas = liberadas por falta de check-in ÷ confirmadas (meta ≤ 10 %)
      B3_reservasNoUsadas: confirmadas ? n(r.liberadas) / confirmadas : 0,
      // B6: tiempo promedio de aprobación (meta ≤ 24 h)
      B6_tiempoPromedioAprobacionHoras: r.horas_aprobacion === null ? null : Number(r.horas_aprobacion),
      // B6: trazabilidad completa. Por diseño, toda reserva tiene solicitante y fecha (columnas obligatorias)
      B6_trazabilidadCompleta: 1,
    };
  }

  /** Todas las reservas del período con su trazabilidad (R7), incluida la cancelación. */
  async reservas(q: RangoFechas): Promise<FilaReserva[]> {
    const filas = await this.prisma.$queryRaw<(Omit<FilaReserva, 'horasAprobacion'> & { horasAprobacion: number | null })[]>`
      SELECT t.reserva_id                                      AS "reservaId",
             t.inicio, t.fin,
             t.estado::text                                    AS estado,
             t.espacio,
             se.nombre                                         AS sede,
             ta.nombre                                         AS "tipoActividad",
             t.origen::text                                    AS origen,
             t.asistentes,
             s.descripcion,
             t.solicitado_en                                   AS "solicitadoEn",
             ps.nombres || ' ' || ps.apellido_paterno          AS solicitante,
             pa.nombres || ' ' || pa.apellido_paterno          AS aprobador,
             (t.decision IS NOT NULL AND t.decidido_por_usuario_id IS NULL) AS "aprobacionAutomatica",
             extract(epoch FROM t.tiempo_aprobacion)::float / 3600 AS "horasAprobacion",
             pc.nombres || ' ' || pc.apellido_paterno          AS "canceladoPor",
             t.cancelado_en                                    AS "canceladoEn",
             t.motivo_cancelacion                              AS "motivoCancelacion"
        FROM reservas.v_reserva_trazabilidad t
        JOIN reservas.solicitud s       ON s.id = t.solicitud_id
        JOIN reservas.tipo_actividad ta ON ta.codigo = t.tipo_actividad
        JOIN institucion.sede se        ON se.id = t.sede_id
        JOIN seguridad.usuario us       ON us.id = t.solicitante_usuario_id
        JOIN seguridad.persona ps       ON ps.id = us.persona_id
        LEFT JOIN seguridad.usuario ua  ON ua.id = t.decidido_por_usuario_id
        LEFT JOIN seguridad.persona pa  ON pa.id = ua.persona_id
        LEFT JOIN seguridad.usuario uc  ON uc.id = t.cancelado_por_usuario_id
        LEFT JOIN seguridad.persona pc  ON pc.id = uc.persona_id
       WHERE t.inicio < ${q.hasta} AND t.fin > ${q.desde}
         ${q.sedeId ? Prisma.sql`AND t.sede_id = ${q.sedeId}::uuid` : Prisma.empty}
       ORDER BY t.inicio
       LIMIT 5000`;
    return filas;
  }
}
