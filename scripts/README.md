# Scripts del proyecto

Contexto y configuración: [guía del proyecto](../docs/README.md).

Ejecutar desde la raíz del repositorio. Para la preparación habitual basta con
`npm run check:deploy`; no publica el sitio. Los demás comandos permiten hacer
una comprobación concreta sin repetir toda la preparación.

| Comando | Para qué sirve | Efectos |
| --- | --- | --- |
| `npm run check:deploy` | Validar configuración, probar reservas, lint, build, tipos y exposición de secretos. | Regenera los dos archivos locales de importación y la compilación. Usa proveedores simulados en las pruebas. |
| `npm run check:netlify-env` | Revisar el formato de las variables sin compilar. `-- --classify` muestra cómo importarlas. | Lectura local; `-- --fetch` consulta los calendarios privados. No cambia el modo de Tilopay. |
| `npm run env:split` | Preparar los dos grupos de variables para Netlify. | Escribe `.env.netlify.sin-secretos` y `.env.netlify.secretos`, ignorados por Git y con permisos privados. Conserva el maestro. |
| `npm run check:published` | Comparar tarifas publicadas y revisar los dos iCal de salida. | Consulta la web y su base mediante rutas públicas de lectura. No comprueba pagos ni correo. Por defecto usa el sitio de pruebas. |
| `npm run audit:exposure` | Buscar secretos expuestos en archivos y artefactos públicos. `-- --history` incluye el historial de Git. | Solo lectura; informa nombres/rutas, sin mostrar los valores privados. |
| `npm run check:local-http` | Revisar cabeceras, acceso privado y rechazo de solicitudes inválidas. | Requiere un servidor local en marcha, con configuración aislada; solo admite localhost. No crea reservas. |
| `npm run check:smtp` | Diagnosticar conexión y autenticación de Gmail al configurar o rotar credenciales. | Contacta Gmail con la configuración privada. No envía correos ni prueba la entrega. |
| `npm run admin:password` | Generar el hash de una contraseña administrativa nueva. | Solicita la contraseña en una terminal interactiva y muestra el hash; no actualiza Netlify ni la base. |
| `npm run media:privacy` | Revisar metadatos EXIF/XMP en imágenes WebP públicas. | Solo lectura por defecto; `-- --write` elimina esos metadatos sin recomprimir las imágenes. |

`dev`, `build` y `start` ejecutan la web; `test`, `lint` y `typecheck` permiten
verificar por separado las pruebas, el estilo del código y los tipos.
`build` por sí solo no carga `.env.netlify`.

Los archivos `booking-env.mjs`, `netlify-env-policy.mjs` y
`secret-encodings.mjs` son funciones compartidas por los comandos y las pruebas;
no son comandos adicionales.

Se retiraron `compress-generales.mjs` y `compress-servicios.mjs`: eran conversiones
puntuales con rutas/nombres antiguos, ya sin sus originales, y podían sobrescribir
o borrar imágenes. Las fotos actuales se conservaron. También se retiró el
formateador de variables sin consumidores operativos; `env:split` sigue siendo
la vía para preparar las importaciones.
