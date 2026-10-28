#!/usr/bin/env bash
# Configura el repositorio en GitHub a partir de la EDT del proyecto:
# labels, milestones H1–H8 y una épica por paquete de trabajo de desarrollo.
# Uso: bash scripts/github-setup.sh OWNER/REPO      (requiere `gh auth login`)
set -euo pipefail
REPO="${1:?Uso: $0 OWNER/REPO}"

label() { gh label create "$1" --repo "$REPO" --color "$2" --description "${3:-}" --force >/dev/null; echo "label $1"; }

echo "== Labels"
label historia 1f5fbf "Historia de usuario"
label epica 5319e7 "Paquete de trabajo de la EDT"
label bug d73a4a "Error"
label critico b60205 "Impide reservar o permite reserva doble"
label cambio-alcance fbca04 "Solicitud de cambio (Plan de Alcance §7.3)"
label fase-2 cccccc "Fuera del alcance actual"
label mejora 0e8a16 "Acción de retrospectiva"
label debe b60205 "MoSCoW: Debe"
label deberia d93f0b "MoSCoW: Debería"
label podria fbca04 "MoSCoW: Podría"
for p in api web mobile shared db ci docs; do label "area:$p" c5def5; done
for r in $(seq 1 19); do label "R$r" ededed "Requisito R$r del Acta"; done
for e in 1.4.1 1.4.2 1.4.3 1.4.4 1.4.5 1.4.6 1.4.7 1.4.8 1.4.9 1.4.10 1.5 1.6 1.7; do label "edt:$e" bfdadc; done

echo "== Milestones"
milestone() {
  if gh api "repos/$REPO/milestones?state=all" --jq '.[].title' | grep -qxF "$1"; then echo "existe $1"; return; fi
  gh api "repos/$REPO/milestones" -f title="$1" -f due_on="$2T23:59:00Z" -f description="$3" >/dev/null
  echo "milestone $1"
}
milestone "H3 Prototipo validado" 2026-10-30 "Prototipo navegable web y móvil validado; diseño aprobado"
milestone "H4 Núcleo web" 2026-11-13 "Reservas, aprobaciones, cancelación y anti-choques"
milestone "H5 Web y móvil completas" 2026-11-27 "Sugerencia, notificaciones, dashboard, reportes, proyección y apps móviles"
milestone "H6 UAT aprobada" 2026-12-04 "Pruebas de aceptación aprobadas por el cliente"
milestone "H7 Puesta en marcha" 2026-12-11 "Despliegue, carga inicial y capacitación"
milestone "H8 Cierre" 2026-12-17 "Acta de entrega y aceptación"

echo "== Épicas (una por paquete EDT)"
epica() { # titulo | labels | milestone | cuerpo
  if gh issue list --repo "$REPO" --state all --search "\"$1\" in:title" --json title --jq '.[].title' | grep -qxF "$1"; then
    echo "existe: $1"; return
  fi
  gh issue create --repo "$REPO" --title "$1" --label "$2" --milestone "$3" --body "$4" >/dev/null
  echo "issue: $1"
}
epica "[1.4.1] Usuarios, roles y acceso" "epica,edt:1.4.1,area:api,debe" "H4 Núcleo web" \
  "Entregable **E4**. Cada rol accede solo a lo que le corresponde. Responsable: JL (50 h).
- [x] Login JWT y guard de permisos
- [ ] CRUD de usuarios (DATD / ADMIN_TI)
- [ ] Cambio y recuperación de contraseña
- [ ] Carga masiva de usuarios"
epica "[1.4.2] Recursos: salas, laboratorios, sedes e inventario" "epica,edt:1.4.2,area:api,debe" "H4 Núcleo web" \
  "Entregable **E5**. Responsable: JL (45 h).
- [x] Listar y crear salas
- [ ] Editar / desactivar salas, sedes, carreras
- [ ] Ítems de inventario por sala
- [ ] Pantallas web de administración"
epica "[1.4.3] Importación de planificación semestral" "epica,edt:1.4.3,area:api,R9,debe" "H4 Núcleo web" \
  "Entregable **E5**: ≥ 98 % de registros importados sin intervención. Responsable: JL (55 h).
- [x] Esquema de validación por fila (\`filaPlanificacionSchema\`)
- [ ] Ajustar columnas al Excel real del ITN (**bloqueado: pedir archivo**)
- [ ] Endpoint de carga (xlsx) con informe de errores por fila
- [ ] Generación de reservas \`PLANIFICACION\` semanales del semestre"
epica "[1.4.4] Reservas, aprobaciones, cancelación y anti-choques" "epica,edt:1.4.4,area:api,R1,R4,R5,R8,R11,debe" "H4 Núcleo web" \
  "Entregable **E6**: 0 reservas dobles en ≥ 200 casos. Responsable: JL (100 h).
- [x] Restricción EXCLUDE en PostgreSQL + prueba con 200 casos concurrentes
- [x] Solicitar, aprobar, rechazar, cancelar, historial
- [x] Bandeja de aprobación (web)
- [ ] Calendario de disponibilidad (web)
- [ ] Formulario de solicitud (web)
- [ ] Préstamo de laboratorios exclusivos: validar regla con directores de carrera"
epica "[1.4.5] Sugerencia de sala y alternativas" "epica,edt:1.4.5,area:api,R10,debe" "H5 Web y móvil completas" \
  "Entregable **E7**: sala válida + hasta 3 alternativas (incluye las que se liberan en ≤ 30 min) en < 5 s. Responsable: JL (60 h).
- [x] Regla \`sugerirSalas\` + endpoint
- [ ] Interfaz web
- [ ] Medir tiempo de respuesta con datos reales"
epica "[1.4.6] Notificaciones y liberación de reservas no usadas" "epica,edt:1.4.6,area:api,R6,R18,debe" "H5 Web y móvil completas" \
  "Entregable **E8**. Responsable: JL (40 h).
- [x] Bandeja in-app
- [ ] Envío por correo (SMTP)
- [ ] Push (expo-notifications)
- [ ] Check-in y job de liberación según la regla acordada"
epica "[1.4.7] Dashboard, trazabilidad y reportes personalizados" "epica,edt:1.4.7,area:web,R7,R12,R13,debe" "H5 Web y móvil completas" \
  "Entregable **E9**. Responsable: BN (70 h).
- [x] KPIs, ocupación por sala, detalle al elegir sala, rango desde–hasta
- [ ] Filtros por sede y tipo; gráficos
- [ ] Exportar reporte (CSV / PDF), por día, mes o año
- [ ] Vista de historial (trazabilidad) por reserva"
epica "[1.4.8] Proyección de uso por día y jornada" "epica,edt:1.4.8,area:api,R14,deberia" "H5 Web y móvil completas" \
  "Entregable **E10**. Responsable: JL (40 h).
- [x] Distribución de horas por día y jornada
- [ ] Ranking de días/jornadas de mayor y menor ocupación con historial
- [ ] Informe de horas ociosas (beneficio B8)"
epica "[1.4.9] App móvil de docentes y estudiantes" "epica,edt:1.4.9,area:mobile,R3,R16,debe" "H5 Web y móvil completas" \
  "Entregable **E11**. Responsable: BN (100 h).
- [x] Login, buscar sala con sugerencia, solicitar, avisos
- [ ] Selectores nativos de fecha y hora
- [ ] Mis reservas (ver, cancelar)
- [ ] Notificaciones push
- [ ] Build interna Android e iOS (EAS)"
epica "[1.4.10] App móvil de mantención y aseo" "epica,edt:1.4.10,area:mobile,R15,R17,deberia" "H5 Web y móvil completas" \
  "Entregable **E12**. Responsable: BN (70 h).
- [x] Reporte de daño por sala (notifica a operaciones)
- [ ] Conteo de inventario
- [ ] Foto del daño
- [ ] Web: bandeja de daños y planificación de mantención (bloqueos \`MANTENCION\`)"
epica "[1.5] Pruebas y calidad" "epica,edt:1.5" "H6 UAT aprobada" \
  "Entregable **E13**: ≥ 90 % de casos aprobados, 0 críticos. Responsable: BC (140 h).
- [ ] Plan y casos de prueba
- [ ] Pruebas E2E web (Playwright)
- [ ] Usabilidad web y móvil
- [ ] Dispositivos Android e iOS
- [ ] UAT con usuarios del ITN"
epica "[1.6] Implementación" "epica,edt:1.6" "H7 Puesta en marcha" \
  "Entregable **E14/E15**. Responsables: GP / BC (70 h).
- [ ] Staging (develop) y producción (main)
- [ ] Publicación en tiendas
- [ ] Carga inicial del semestre
- [ ] Capacitación a usuarios clave"
epica "[1.7] Documentación" "epica,edt:1.7,area:docs" "H8 Cierre" \
  "Entregables **E15/E16**. Responsables: BC / GP (70 h).
- [ ] Manual de usuario web y móvil
- [ ] Manual técnico y de administración
- [ ] Acta de entrega y aceptación"

echo "Listo. Siguiente paso: crear el tablero en GitHub Projects y agregar estos issues."
