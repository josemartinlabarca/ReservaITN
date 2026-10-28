# Cómo contribuir

1. Toma un issue del tablero (columna **Listo**) y asígnatelo.
2. Crea una rama desde `develop`: `feat/1.4.4-aprobacion-reservas` (código EDT + descripción).
3. Commits con [Conventional Commits](https://www.conventionalcommits.org/es/): `feat(reservas): aprobar con comentario (#12)`.
4. Abre un PR hacia `develop` usando la plantilla; enlaza el issue con `Closes #N`.
5. El CI debe pasar y al menos un integrante debe aprobar el PR.
6. Se integra con **Squash and merge**.

Detalle completo en [docs/05-flujo-git.md](docs/05-flujo-git.md). Definición de terminado en [docs/01-metodologia.md](docs/01-metodologia.md#definición-de-terminado-dod).
