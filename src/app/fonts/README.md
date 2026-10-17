# Fuentes locales

Lora y Nunito Sans se incluyen en el repositorio para que `next build` no dependa
de Google Fonts ni del análisis de sus URL por `next/font/google`. Se cargan con
`next/font/local`, conservando `--font-lora`, `--font-nunito` y `display: swap`.

Archivos variables originales, sin modificar, del repositorio oficial Google Fonts:

- `Lora-Variable.ttf`: `ofl/lora/Lora[wght].ttf`, revisión
  `186331d77cc99caaa9c3b52391fd2b519c9e1ee8`, pesos 400–700.
- `NunitoSans-Variable.ttf`: `ofl/nunitosans/NunitoSans[YTLC,opsz,wdth,wght].ttf`,
  revisión `8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5`, pesos 200–1000.

Las licencias originales SIL Open Font License 1.1 se conservan junto a cada fuente.
No hay scripts de descarga en el build, servicios nuevos ni variables adicionales.

SHA-256:

```text
822a6621ccbe8d97d20ac88c1c41f5615c9c2c202eaa75f272cd452aac6475a7  Lora-Variable.ttf
f934d7142fb4784bf828da485b7dcbd90c0c80d514e9d49a5da0ed3a1ae2491d  NunitoSans-Variable.ttf
```
