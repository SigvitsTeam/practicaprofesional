# Invitaciones y recuperación de contraseña

## Responsabilidades

Supabase Auth verifica el correo y almacena las contraseñas. NestJS administra el perfil, los
roles, el alcance, la vinculación de identidad y la autorización institucional. Crear un perfil
en SIGVITS **no envía un correo**: después se utiliza **Invitar por correo**.

La confirmación de Supabase de que aceptó una solicitud no demuestra entrega al buzón.
Para usuarios nuevos, primero debe completarse la invitación; recuperar contraseña no crea
una cuenta ni asigna permisos.

## Configuración local necesaria

En `backend/.env`, conservar el `AUTH_ISSUER` del proyecto y configurar:

```dotenv
AUTH_ADMIN_SECRET=<clave administrativa de servidor del proyecto Supabase>
AUTH_INVITATION_REDIRECT_URL=http://localhost:4200/?auth=invite
```

La clave debe ser una clave secreta administrativa de servidor de Supabase (o la `service_role`
heredada), no la clave pública `publishable`/`anon`. No pegarla en el chat, el frontend, un
archivo versionado ni logs. Reiniciar NestJS después de modificar su entorno.

El frontend utiliza exclusivamente la URL del proyecto y su clave pública. Conservar la
configuración existente de `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`; nunca colocar allí
`AUTH_ADMIN_SECRET`.

En Supabase → Authentication → URL Configuration:

1. Para desarrollo, Site URL: `http://localhost:4200/`.
2. Autorizar estas Redirect URLs exactas:
   - `http://localhost:4200/?auth=invite`
   - `http://localhost:4200/?auth=recovery`
3. Para staging/producción, usar los orígenes HTTPS correspondientes en la configuración del
   backend y la lista permitida. No usar comodines generales en producción.

La redirección se envía como parámetro `redirect_to` de la solicitud a Auth. Si Supabase no
permite la URL, puede volver a Site URL en su lugar. Véase
[configuración oficial de redirecciones](https://supabase.com/docs/guides/auth/redirect-urls).

## Correo saliente y plantillas

Revisar Authentication → Email/SMTP Settings y los registros de Auth. No asumir que existe
SMTP propio porque las peticiones de autenticación funcionen.

El servicio predeterminado de Supabase está restringido a destinatarios del equipo del proyecto,
tiene límites muy bajos y no garantiza entrega. Para invitar destinatarios externos se necesita
SMTP propio correctamente configurado. Las restricciones vigentes se documentan en
[Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

Con el proveedor elegido, configurar host, puerto, credenciales y remitente autorizado; verificar
el dominio y los registros que exija ese proveedor. No exponer sus credenciales al navegador.
Revisar también spam, rechazos y supresiones en el proveedor; no hacer reintentos masivos.

En las plantillas **Invite user** y **Reset password**, conservar un enlace con
`{{ .ConfirmationURL }}`. Ese enlace verifica primero en Supabase y después vuelve al frontend.
La aplicación soporta las respuestas con fragmento `type=invite` o `type=recovery` y, para
plantillas personalizadas, `token_hash` con uno de esos tipos. No admite callbacks PKCE de
plantillas ajenas a este flujo. Véanse las
[plantillas oficiales](https://supabase.com/docs/guides/auth/auth-email-templates).

Mantener la confirmación de correo habilitada. Establecer en Supabase una política de contraseña
coherente con el mínimo de 12 caracteres del formulario; el proveedor sigue siendo la autoridad
de validación y debe aplicar su política aunque se omita el frontend.

## Prueba real de aceptación pendiente

Usar una cuenta de prueba autorizada y un buzón accesible por su responsable. No adjuntar tokens,
contraseñas, enlaces completos de acceso ni datos personales a la evidencia.

1. Iniciar sesión como administrador con permiso para gestionar el perfil de prueba.
2. En Administración → Usuarios, crear o seleccionar el perfil pendiente de identidad.
3. Pulsar **Invitar por correo**, indicar el motivo y decidir si se activa el perfil al vincularlo.
   Si falla, el mensaje permanece en el diálogo. No repetir sin revisar el motivo.
4. Confirmar recepción en el buzón y abrir el enlace en el equipo que ejecuta el frontend local.
   `localhost` en otro equipo o teléfono no apunta al equipo de desarrollo.
5. Verificar que aparece la dirección correcta del destinatario. Definir y confirmar una
   contraseña nueva. La aplicación vuelve al acceso mediante el botón correspondiente, sin
   iniciar una sesión institucional automáticamente.
6. Iniciar sesión y verificar rol, alcance y denegaciones. Si el administrador dejó el perfil
   inactivo, no debe poder entrar a la información institucional aunque el correo esté confirmado.
7. Cerrar sesión. Escribir el correo en el login y utilizar **¿Olvidaste tu contraseña?**.
   El mensaje de solicitud es genérico para no revelar si una cuenta está registrada.
8. Recibir y abrir ese segundo enlace, cambiar la contraseña y comprobar que la anterior ya no
   permite iniciar una sesión nueva. Verificar rechazo de enlaces vencidos o reutilizados.

Los enlaces se eliminan de la dirección del navegador y sus tokens se conservan únicamente en
memoria durante el cambio; recargar la página pierde ese estado. Al terminar se intenta cerrar
la sesión de Auth de ese enlace. La validación real de tokens sigue a cargo de Supabase.

Si Supabase ya creó una identidad pero falló la vinculación local, no borrar usuarios ni crear
duplicados: revisar los registros y usar la vinculación administrativa con el identificador
inmutable, después de verificar identidad y permisos. El envío de correo y la transacción local
no constituyen una transacción distribuida atómica.

## Vista visual aislada de QA

Para revisar disposición sin enviar correos ni modificar datos reales:

```powershell
# Terminal 1, desde C:\PRACTICAPROFESIONAL\frontend
npm start -- --port 4200

# Terminal 2, desde C:\PRACTICAPROFESIONAL
node tools/qa/serve-ui-preview.mjs
```

Abrir `http://localhost:4300/` y elegir el usuario de prueba. Esta vista usa datos sintéticos y
rechaza todas las escrituras con HTTP 503 para probar errores visibles. No sirve para probar
entrega de correo ni éxito del proveedor. Sólo escucha en loopback; no publicar ni desplegar
este servidor de QA. Cerrar ambas terminales con Ctrl+C al terminar.
