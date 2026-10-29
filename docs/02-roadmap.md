# 2. Roadmap paso a paso

El desarrollo sigue la **EDT 1.4** del Plan de Gestión del Alcance (Tabla 2) y los **tres incrementos**
de su §7.4: *núcleo web → funciones de análisis → aplicaciones móviles*, con una demo a la patrocinadora
y al subdirector al cierre de cada uno. Las semanas se cuentan desde el 07/10/2026; hoy es la **semana 4**.

Leyenda: ✅ hecho en la base · 🟡 parcial · ⬜ pendiente

## Estructura del desarrollo (EDT 1.4 → código)

| EDT | Paquete | Horas | Resp. | Entregable | Incremento | API | Web / Móvil | Estado |
|---|---|---|---|---|---|---|---|---|
| 1.4.1 | Usuarios, roles y acceso | 50 | JL | E4 | 1 | `usuarios/` | web `login/` | 🟡 login, guard, crear/listar usuarios |
| 1.4.2 | Recursos: salas, labs, sedes, inventario | 45 | JL | E5 | 1 | `recursos/` | — | 🟡 listar/crear salas |
| 1.4.3 | Importación de planificación | 55 | JL | E5 | 1 | `importacion/` | — | 🟡 carga .xlsx + informe por fila |
| 1.4.4 | Reservas, aprobaciones, cancelación, anti-choques | 100 | JL | E6 | 1 | `reservas/` | web `aprobaciones/` | ✅ API · 🟡 web |
| 1.4.5 | Sugerencia de sala y alternativas | 60 | JL | E7 | 2 | `sugerencia/` | móvil `docentes/` | ✅ API |
| 1.4.6 | Notificaciones y liberación | 40 | JL | E8 | 2 | `notificaciones/` | móvil `comun/` | 🟡 bandeja in-app |
| 1.4.7 | Dashboard, trazabilidad, reportes | 70 | BN | E9 | 2 | `dashboard/` | web `dashboard/` | 🟡 KPIs, por sala, detalle, desde–hasta |
| 1.4.8 | Proyección de uso por día y jornada | 40 | JL | E10 | 2 | `proyeccion/` | web `dashboard/` | 🟡 ranking mayor/menor uso |
| 1.4.9 | App móvil docentes y estudiantes | 100 | BN | E11 | 3 | (usa 1.4.4–1.4.6) | móvil `docentes/` | 🟡 buscar, sugerir, solicitar, avisos |
| 1.4.10 | App móvil mantención y aseo | 70 | BN | E12 | 3 | `mantencion/` | móvil `mantencion/` | 🟡 reporte de daños |
| | **Total desarrollo** | **630** | | | | | | |

Incremento 1 = 250 h · Incremento 2 = 210 h · Incremento 3 = 170 h.

## ⚠️ Capacidad: las horas de la EDT no caben en el calendario tal como están asignadas

| Verificación | Horas necesarias | Horas disponibles |
|---|---|---|
| Desarrollo completo (1.4) en semanas 5–8 con **todo el equipo** (137 h/semana) | 630 | 548 |
| Paquetes de José (1.4.1–1.4.6, 1.4.8) entre semanas 4 y 8 (39 h/semana) | 390 | 195 |
| Paquetes de Benjamín (1.4.7, 1.4.9, 1.4.10) en semanas 7–8 (35 h/semana) | 240 | 70 |

El Plan de Alcance dice que "cada paquete cuenta con apoyo de todo el equipo", y eso es obligatorio,
no opcional. **Propuesta para validar en la planificación del sprint 1:**

1. **El desarrollo parte ya (semana 4)**, sin esperar a H3. La base del repositorio adelanta parte
   de 1.4.1, 1.4.3, 1.4.4, 1.4.5 y 1.4.8.
2. **Gonzalo** termina el diseño (1.3) en la semana 4 y desde la semana 5 toma el servidor de **1.4.2**
   y **1.4.6**, con José como revisor.
3. **Benjamín** empieza la app móvil (1.4.9) en la **semana 6**, en paralelo al núcleo web, porque es
   el paquete más grande y el de mayor riesgo (RI6).
4. **Braulio** automatiza pruebas (1.5.1–1.5.2) desde la semana 5, con lo que libera a los
   desarrolladores de esa tarea.
5. Si aun así no alcanza, se aplica MoSCoW: **R14, R15, R17 y R18 son "Debería"** y son los primeros
   candidatos a simplificarse, con aprobación de la patrocinadora (control de cambios).

---

## Paso 0: preparar el repositorio (semana 4, 28–30/10) · GP

1. Crear el repositorio en GitHub y subir esta base (ver [05-flujo-git.md](05-flujo-git.md#primer-push)).
2. Ejecutar `scripts/github-setup.sh`, que crea los labels, los milestones H3–H8 y una épica por paquete EDT.
3. Crear el tablero en GitHub Projects con un campo *Incremento* (1, 2, 3).
4. Proteger `main` y `develop`.
5. Cada integrante levanta el entorno local (README).
6. Revisar el modelo de datos con el encargado de informática (E2).
7. **H3 (30/10):** se valida el prototipo y sus observaciones se convierten en issues.
8. **Pedir el Excel real de planificación**, porque bloquea el cierre de 1.4.3 (RI3).

## Incremento 1: Núcleo web (semanas 5–6, 02–13/11) → **H4**

| Semana | Trabajo | Resp. (apoyo) |
|---|---|---|
| 5 | 1.4.1: gestión de usuarios en la web, recuperación de contraseña | JL (BN web) |
| 5 | 1.4.2: CRUD de sedes, salas, laboratorios, exclusividad y equipamiento + pantallas web | GP (BN web) |
| 5 | 1.4.3: ajustar columnas al Excel real, pantalla de carga con informe de errores | JL |
| 6 | 1.4.4: calendario de disponibilidad web, formulario de solicitud, regla de préstamo de laboratorios (R8) | JL (BN web) |
| 5–6 | 1.5.1–1.5.2: casos de prueba y pruebas del núcleo | BC |
| 6 | Staging desplegado desde `develop` | GP |

**Demo H4 (13/11):** reservar, aprobar, cancelar e importar el semestre.
**Criterios:** 0 reservas dobles en ≥ 200 casos (`test:db`, ya automatizado) y ≥ 98 % del Excel importado (E5).
**Release:** `v0.4.0`.

## Incrementos 2 y 3 en paralelo (semanas 7–8, 16–27/11) → **H5**

El documento fija ambos para H5, así que corren al mismo tiempo: el **servidor** (JL, GP) avanza
el análisis y el **frontend** (BN) avanza las apps móviles.

| Semana | Incremento 2: Análisis | Resp. | Incremento 3: Móviles | Resp. |
|---|---|---|---|---|
| 7 | 1.4.5: interfaz web de sugerencia, medir < 5 s | JL | 1.4.9: selector de fecha nativo, mis reservas, cancelar | BN |
| 7 | 1.4.6: correo SMTP, push, check-in y job de liberación (R18) | GP | Build interna Android/iOS (EAS) → **enviar a revisión de tiendas** | GP |
| 8 | 1.4.7: filtros por sede/tipo, gráficos, exportar CSV/PDF, vista de trazabilidad | BN | 1.4.10: conteo de inventario, foto del daño | BN |
| 8 | 1.4.8: informe de horas ociosas (B8), comparación entre períodos | JL | Planificación de mantención en web (bloqueos `MANTENCION`, R15) | JL |

**Demo H5 (27/11):** web y apps completas, con el 100 % de los requisitos *Debe* (OE4).
Desde aquí rige el **congelamiento de funcionalidades**: solo entran correcciones. **Release:** `v0.5.0`.

## Semana 9 (30/11–04/12) → **H6**: UAT
- BC conduce las pruebas de aceptación con usuarios reales en staging. Meta: ≥ 90 % aprobados (E13).
- Los bugs críticos se corrigen el mismo día en ramas `fix/*`. **Release:** `v0.9.0`.

## Semana 10 (07–11/12, feriado 08/12) → **H7**: Puesta en marcha
- GP: migraciones en producción, carga inicial del semestre (1.6.3) y publicación de las apps (1.6.2).
- BC: capacitación a usuarios clave (1.6.4). **Release:** `v1.0.0`.

## Semana 11 (14–17/12) → **H8**: Cierre
- Holgura, manuales (1.7), acta de entrega y lecciones aprendidas.
- Soporte de 30 días hasta el 10/01/2027 en ramas `hotfix/*`.
