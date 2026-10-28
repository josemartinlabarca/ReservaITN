# 1. Metodología de trabajo

## Enfoque: híbrido (como define el Plan de Gestión del Alcance §7.4)

| Parte | Qué fija | Herramienta en GitHub |
|---|---|---|
| **Predictiva** | Alcance (E1–E16), hitos H1–H8, presupuesto, fecha de término 17/12/2026 (no negociable) | **Milestones** H1…H8 con fecha tope |
| **Adaptativa** | Diseño y desarrollo en incrementos semanales con demo al cliente | **Sprints de 1 semana** en GitHub Projects (campo *Iteration*) |

Con solo 4 semanas de desarrollo (semanas 5–8) los sprints son de **1 semana**: así hay 4 puntos de
control antes de H5 y cualquier desvío se detecta a tiempo.

## De la EDT al backlog

```
EDT (1.4.4 Reservas…)  ──►  Épica (issue con label "epica")
                              ├── Historia: "Como docente quiero solicitar una sala…"   (issue)
                              ├── Historia: "Como director de carrera quiero aprobar…"   (issue)
                              └── Tarea técnica: "Restricción EXCLUDE en PostgreSQL"     (issue)
```

- Cada **paquete de trabajo** de la EDT es una **épica** (label `edt:1.4.4`).
- Cada épica se divide en **historias de usuario** de máximo 2 días de trabajo.
- Cada historia lleva el **requisito** que cumple (label `R1`…`R19`), su **prioridad MoSCoW**
  (`debe`, `deberia`, `podria`) y el **hito** (milestone).
- El script [`scripts/github-setup.sh`](../scripts/github-setup.sh) crea labels, hitos y épicas.

## Tablero (GitHub Projects)

`Backlog → Listo → En curso → En revisión (PR) → En prueba (QA) → Hecho`

- **Listo** solo admite issues que cumplen la *Definición de Listo*.
- **En prueba**: Braulio valida contra los criterios de aceptación en el entorno de staging.
- Límite: máximo **2 issues "En curso" por persona**.

## Ceremonias (ajustadas a un equipo de 4)

| Ceremonia | Cuándo | Duración | Resultado |
|---|---|---|---|
| Planificación del sprint | Lunes 09:00 | 45 min | Issues del sprint movidos a *Listo*, asignados |
| Daily | Todos los días (puede ser asíncrono en el canal del equipo) | 10 min | Qué hice / qué haré / bloqueos |
| Revisión con el cliente | Viernes (en hitos H4, H5 obligatoria) | 30 min | Demo del incremento a la patrocinadora y al subdirector |
| Retrospectiva | Viernes, después de la revisión | 20 min | 1–2 acciones de mejora (issue con label `mejora`) |
| Seguimiento con la patrocinadora | Cada 2 semanas y en cada hito | 30 min | Estado, decisiones y cambios (Registro de Interesados §4) |

## Roles en el repositorio

| Integrante | Rol en el proyecto | Responsabilidad en GitHub |
|---|---|---|
| Benjamín Naveas (BN) | Director del proyecto, frontend | Dueño del tablero y milestones; revisa PR de `apps/web` y `apps/mobile` |
| José Labarca (JL) | Full stack (BD, servidor, lógica) | Revisa PR de `apps/api` y `packages/shared`; dueño del modelo de datos |
| Gonzalo Pino (GP) | Ingeniero de sistemas | Arquitectura, CI/CD, despliegue, ADR; administra `main` y releases |
| Braulio Campos (BC) | Tester UA | Casos de prueba, mueve issues de *En prueba* a *Hecho*, abre bugs |

## Definición de Listo (DoR)

Un issue entra a un sprint solo si:

- [ ] Tiene criterio de aceptación verificable (idealmente en formato *Dado / Cuando / Entonces*).
- [ ] Está enlazado a un requisito (R*) y a un paquete EDT.
- [ ] Se estimó en ≤ 2 días; si no, se divide.
- [ ] No depende de información del cliente pendiente (p. ej. el Excel real).

## Definición de Terminado (DoD)

Una historia está **Hecha** cuando:

- [ ] El código está integrado en `develop` mediante PR aprobado por otro integrante.
- [ ] El CI pasa: compilación, tipos, pruebas unitarias e integración.
- [ ] Las validaciones nuevas están en `packages/shared` (no duplicadas en web/móvil/API).
- [ ] Toda regla de negocio nueva tiene prueba unitaria.
- [ ] Si toca la BD, incluye migración de Prisma revisada.
- [ ] Braulio la validó en staging contra el criterio de aceptación.
- [ ] La trazabilidad ([06-trazabilidad.md](06-trazabilidad.md)) está actualizada.

## Control de cambios

Cualquier pedido nuevo del cliente se registra con la plantilla **Solicitud de cambio** del repositorio
(sigue los 5 pasos del Plan de Alcance §7.3). Nada entra al sprint hasta que la patrocinadora lo aprueba.
Los cambios no esenciales se etiquetan `fase-2` y quedan fuera de este proyecto.

## Métricas que se revisan cada viernes

- Issues cerrados vs. planificados en el sprint.
- % de requisitos **Debe** implementados (meta OE4: 100 % en semana 8).
- Bugs críticos abiertos (deben ser 0 para aceptar un entregable).
- Horas reales vs. EDT por paquete (reportadas en el issue de la épica).
