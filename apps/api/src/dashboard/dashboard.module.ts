import { Controller, Get, Module, Query } from '@nestjs/common';
import { HORARIO, horasOcupadas, indiceOcupacion, rangoFechasSchema, type RangoFechas } from '@reservaitn/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../comun/prisma.service';
import { RequierePermiso } from '../comun/auth.guard';
import { ZodPipe } from '../comun/zod.pipe';

/** Días hábiles (lun–sáb) en el rango × horas del horario institucional. */
export function horasDisponiblesPorSala(desde: Date, hasta: Date): number {
  const horasDia = HORARIO.cierreHora - HORARIO.aperturaHora;
  let dias = 0;
  for (let d = new Date(desde); d < hasta; d.setDate(d.getDate() + 1)) if (d.getDay() !== 0) dias++;
  return dias * horasDia;
}

/** Dashboard, trazabilidad y reportes “desde–hasta” (E9 / WBS 1.4.7). */
@Controller('dashboard')
class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @RequierePermiso('dashboard:ver')
  @Get('ocupacion')
  async ocupacion(@Query(new ZodPipe(rangoFechasSchema)) q: RangoFechas) {
    const espacios = await this.prisma.espacio.findMany({
      where: { activo: true, reservable: true, ...(q.sedeId ? { edificio: { sede_id: q.sedeId } } : {}) },
      select: { id: true, codigo: true, nombre: true, tipo_espacio: { select: { codigo: true } }, edificio: { select: { sede: { select: { nombre: true } } } } },
    });
    // Ocupación = reservas aprobadas de uso real; la mantención no cuenta como uso (B3)
    const reservas = await this.prisma.reserva.findMany({
      where: {
        estado: 'APROBADA',
        solicitud: { origen: { not: 'MANTENCION' } },
        inicio: { lt: q.hasta },
        fin: { gt: q.desde },
        espacio_id: { in: espacios.map((e) => e.id) },
      },
      select: { espacio_id: true, inicio: true, fin: true },
    });
    const rango = { inicio: q.desde, fin: q.hasta };
    const disponibles = horasDisponiblesPorSala(q.desde, q.hasta);

    const porEspacio = espacios
      .map((e) => {
        const horas = horasOcupadas(reservas.filter((r) => r.espacio_id === e.id), rango);
        return {
          espacioId: e.id,
          codigo: e.codigo,
          nombre: e.nombre,
          sede: e.edificio.sede.nombre,
          tipo: e.tipo_espacio.codigo,
          horasReservadas: Math.round(horas * 10) / 10,
          indice: indiceOcupacion(horas, disponibles),
        };
      })
      .sort((a, b) => b.indice - a.indice);

    const total = porEspacio.reduce((acc, s) => acc + s.horasReservadas, 0);
    return {
      rango: { desde: q.desde, hasta: q.hasta },
      indiceGlobal: indiceOcupacion(total, disponibles * espacios.length),
      totalReservas: reservas.length,
      porEspacio,
    };
  }

  /**
   * Todas las reservas del período con su trazabilidad (R7): quién pidió, cuándo, quién aprobó
   * (o si fue automática) y el estado. Incluye pendientes, que no cuentan en la ocupación.
   */
  @RequierePermiso('dashboard:ver')
  @Get('reservas')
  reservas(@Query(new ZodPipe(rangoFechasSchema)) q: RangoFechas) {
    return this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT t.reserva_id                                      AS "reservaId",
             t.inicio, t.fin,
             t.estado::text                                    AS estado,
             t.espacio,
             t.tipo_actividad                                  AS "tipoActividad",
             t.origen::text                                    AS origen,
             t.asistentes,
             s.descripcion,
             t.solicitado_en                                   AS "solicitadoEn",
             ps.nombres || ' ' || ps.apellido_paterno          AS solicitante,
             pa.nombres || ' ' || pa.apellido_paterno          AS aprobador,
             (t.decision IS NOT NULL AND t.decidido_por_usuario_id IS NULL) AS "aprobacionAutomatica"
        FROM reservas.v_reserva_trazabilidad t
        JOIN reservas.solicitud s ON s.id = t.solicitud_id
        JOIN seguridad.usuario us ON us.id = t.solicitante_usuario_id
        JOIN seguridad.persona ps ON ps.id = us.persona_id
        LEFT JOIN seguridad.usuario ua ON ua.id = t.decidido_por_usuario_id
        LEFT JOIN seguridad.persona pa ON pa.id = ua.persona_id
       WHERE t.inicio < ${q.hasta} AND t.fin > ${q.desde}
         ${q.sedeId ? Prisma.sql`AND t.sede_id = ${q.sedeId}::uuid` : Prisma.empty}
       ORDER BY t.inicio
       LIMIT 500`;
  }

  /** Indicadores del Plan de Gestión de Beneficios, calculados desde la vista de trazabilidad. */
  @RequierePermiso('dashboard:ver')
  @Get('indicadores')
  async indicadores(@Query(new ZodPipe(rangoFechasSchema)) q: RangoFechas) {
    const [r] = await this.prisma.$queryRaw<
      { total: bigint; pendientes: bigint; liberadas: bigint; confirmadas: bigint; horas_aprobacion: number | null; con_trazabilidad: bigint }[]
    >`
      SELECT count(*)                                                     AS total,
             count(*) FILTER (WHERE estado = 'PENDIENTE')                 AS pendientes,
             count(*) FILTER (WHERE estado = 'LIBERADA')                  AS liberadas,
             count(*) FILTER (WHERE estado IN ('APROBADA', 'LIBERADA'))   AS confirmadas,
             avg(extract(epoch FROM tiempo_aprobacion) / 3600)
               FILTER (WHERE origen = 'SOLICITUD' AND decidido_por_usuario_id IS NOT NULL) AS horas_aprobacion,
             count(*) FILTER (WHERE solicitante_usuario_id IS NOT NULL AND solicitado_en IS NOT NULL
                                AND (decision IS NOT NULL OR estado = 'PENDIENTE')) AS con_trazabilidad
        FROM reservas.v_reserva_trazabilidad
       WHERE inicio >= ${q.desde} AND inicio < ${q.hasta}`;
    const n = (x: bigint) => Number(x);
    return {
      totalReservas: n(r.total),
      pendientes: n(r.pendientes),
      // B3: reservas no usadas = liberadas por falta de check-in ÷ confirmadas
      B3_reservasNoUsadas: n(r.confirmadas) ? n(r.liberadas) / n(r.confirmadas) : 0,
      // B6: tiempo promedio de aprobación (meta ≤ 24 h) y % con trazabilidad completa (meta 100 %)
      B6_tiempoPromedioAprobacionHoras: r.horas_aprobacion === null ? null : Number(r.horas_aprobacion),
      B6_trazabilidadCompleta: n(r.total) ? n(r.con_trazabilidad) / n(r.total) : 1,
    };
  }
}

@Module({ controllers: [DashboardController] })
export class DashboardModule {}
