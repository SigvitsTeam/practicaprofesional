# QA de invitaciones, recuperación e interfaz — 3 de septiembre de 2026

## Diagnóstico comprobado

Se consultó en modo lectura exclusivamente el correo de prueba reportado por el usuario.
El perfil de SIGVITS existía, estaba inactivo y tenía cero identidades externas vinculadas.
La búsqueda de ese correo en `auth.users` no devolvió una identidad. No se modificaron registros.

En la configuración local inspeccionada faltaban `AUTH_ADMIN_SECRET` y
`AUTH_INVITATION_REDIRECT_URL`. Además, el adaptador enviaba la redirección dentro del JSON,
en vez del parámetro `redirect_to` utilizado por Auth. Esto no prueba qué configuración estaba
activa ayer en otro proceso ni permite asegurar una causa SMTP concreta: no se consultó el panel
administrativo del proveedor de correo ni se verificó entrega real.

El frontend no disponía de un flujo para consumir los enlaces de invitación/recuperación y
establecer la contraseña. La solicitud de recuperación no especificaba redirección y podía
aparentar éxito aun sin proveedor configurado.

## Cambios

- Adaptador de invitación: redirección correcta, configuración obligatoria, errores diferenciados
  de SMTP/autorización/límites/identidad existente y rechazo de respuestas inválidas.
- Validación de motivo y versión del perfil antes de producir el efecto externo de enviar correo.
  Se conservan las comprobaciones de permisos, alcance y concurrencia del repositorio.
- Servicio separado para enlaces: valida la identidad con Supabase, elimina parámetros de la URL,
  mantiene el token sólo en memoria y no lo convierte en una sesión institucional. Los cambios
  de contraseña tienen validación, timeout y protección contra doble envío.
- Recuperación desde el login: redirección del mismo origen, timeout, mensaje genérico y rechazo
  explícito de entornos sin Auth. Se mantiene el alias `+` de las direcciones de correo.
- Invitación: error persistente dentro del diálogo; la confirmación informa aceptación de la
  solicitud, no entrega del mensaje. Controles deshabilitados mientras se envía.
- Cabecera: se eliminó una regla duplicada que rotaba y limitaba a 30×30 px todo el bloque de
  usuario. Filtros y controles se adaptan al espacio disponible. Avisos por encima de diálogos.
- Formularios: áreas de texto completas, checkboxes sin estiramiento, nombres largos ajustados,
  modales desplazables y acciones de tabla sin convertir la celda en un contenedor flex.
- Catálogo e historial territorial: notificación explícita de los cambios asíncronos en Angular
  sin Zone.js. El catálogo ahora se representa sin necesitar un clic adicional.
- Contraste: pantalla de contraseña en ambos temas y panel claro de login aislado de los colores
  heredados del tema oscuro de la sesión anterior.

## Verificación automatizada

| Control | Resultado |
| --- | --- |
| Backend: formato, TypeScript y ESLint | Aprobados |
| Backend: unitarias | 228 aprobadas |
| Backend: HTTP E2E | 39 aprobadas |
| Backend: compilaciones API y worker | Aprobadas |
| Frontend: formato y ESLint | Aprobados |
| Frontend: tests | 153 aprobados |
| Frontend: TypeScript de tests y compilación de producción | Aprobados |
| Política de repositorio y `git diff --check` | Aprobados |

Cobertura nueva: redirecciones de invitación y recuperación, fallos de configuración, códigos
de error del proveedor, timeout, respuestas malformadas, versión obsoleta antes del envío,
enlaces inválidos/vencidos, correo sin verificar, tokens revocados, contraseñas incompatibles,
solicitudes simultáneas, salida durante validación, no persistencia de tokens y aislamiento de
una sesión anterior. Prueba de regresión del catálogo asíncrono sin `detectChanges` manual
ni interacción adicional del usuario.

No se cambiaron esquema ni migraciones. No se repitió la suite PostgreSQL aislada en esta tarea;
no confundir pruebas unitarias/HTTP con una prueba de entrega real de correo.

## Revisión visual

Se utilizó el navegador integrado con Angular local y el proxy de QA de loopback
`tools/qa/serve-ui-preview.mjs`. Datos sintéticos; todas las escrituras rechazadas localmente.
Ninguna petición de invitación de esta prueba llegó a Supabase o a un proveedor SMTP.

En el panel de inicio se midieron cabecera/filtros en:

| Ventana | Ancho cliente / ancho del documento | Intersecciones entre controles de cabecera |
| --- | --- | --- |
| 1366×900 | 1351 / 1351 px | Ninguna |
| 1024×768 | 1009 / 1009 px | Ninguna |
| 768×1024 | 753 / 753 px | Ninguna |
| 390×844 | 375 / 375 px | Ninguna |
| 320×480 | 305 / 305 px | Ninguna |

La diferencia de 15 px corresponde a la barra vertical de desplazamiento. No hay desbordamiento
horizontal de la página en estas mediciones. Las tablas anchas conservan su propio scroll.

En Administración se comprobó que el usuario sintético apareciera tras cargar, sin otro clic,
y que un HTTP 503 de invitación dejara visible su explicación dentro del modal y permitiera
reintentar/cancelar. Revisadas capturas de cabecera, filtros y modal en escritorio y móvil.
En 320×480, el modal midió 257×432 px dentro de la ventana y desplazó su contenido largo;
se pudo pulsar Cancelar y cerrarlo.

El enlace sintético de recuperación vencido mostró el error y ninguna entrada de contraseña;
su query/hash se eliminaron. Se comprobó el retorno al login sin sesión institucional.
Esta revisión no equivale a una certificación WCAG completa ni a una matriz de todos los
dispositivos, pantallas y navegadores.

## Pendiente para aceptación funcional real

Configurar la credencial administrativa, las URLs permitidas y el correo saliente; luego
completar los dos recorridos reales (invitación y recuperación) con un buzón autorizado.
No se enviaron correos reales, no se crearon usuarios en Supabase y no se cambiaron contraseñas
reales durante esta tarea. La entrega y el uso de un enlace real **permanecen sin certificar**.

Pasos: [runbook de invitaciones y recuperación](runbook-invitaciones-y-recuperacion.md).
