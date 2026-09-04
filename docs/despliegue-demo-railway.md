# Presentación: Railway + Vercel + Supabase

Esta guía usa un solo repositorio, un servicio de Railway para API y worker, un
proyecto Vercel para Angular y el proyecto Supabase existente. El despliegue no
ejecuta migraciones ni crea usuarios automáticamente.

## 1. Publicar los archivos de configuración

Subir a la rama conectada a Railway estos archivos nuevos:

- `deploy/docker/railway-demo.Dockerfile`
- `deploy/docker/run-demo.mjs`
- `deploy/config/railway.env.example`
- `docs/despliegue-demo-railway.md`

También deben estar en GitHub `frontend/vercel.json` y la versión actual de
`frontend/tools/write-runtime-config.mjs`. No subir archivos `.env` ni secretos.

## 2. Supabase: conservar el proyecto que ya funciona

Si el sistema funciona localmente con Supabase, utilizar el mismo proyecto y los
valores de `backend/.env`; no crear otra base vacía ni volver a crear usuarios.

Recopilar en el dashboard, sin publicar secretos:

- Project URL: `https://PROJECT_REF.supabase.co`.
- API Keys: clave publishable (o anon), pública para Angular.
- API Keys: clave secret de servidor (o service_role) para `AUTH_ADMIN_SECRET`,
  exclusivamente en Railway.
- Connect: conexión PostgreSQL. La contraseña es la de la base de datos, no una API key.

Para este repositorio, `DATABASE_URL` se utiliza en la API y `DIRECT_URL` en las
migraciones. Preferir los valores ya verificados localmente. El pooler Transaction
usa 6543 y el Session usa 5432; copiar el host y usuario exactos del panel. El usuario
runtime configurado puede ser diferente del propietario usado para migraciones.
Las URL remotas deben incluir `sslmode=require` (o `verify-ca`/`verify-full`). Si ya
hay parámetros, agregar `&sslmode=require`; de lo contrario, `?sslmode=require`.
Codificar caracteres especiales de la contraseña dentro de la URL.

No reemplazar el usuario runtime por `anon` o `authenticated`: el backend requiere
los permisos descritos en `runbook-despliegue-y-rollback.md`. Si se prepara una base
nueva, también hay que provisionar el rol runtime según ese runbook.

Verificar Authentication → Signing Keys: la API acepta JWT con ES256 o RS256.
Una configuración antigua basada solo en HS256 necesita una migración de claves
planificada y un nuevo inicio de sesión; no se arregla copiando la clave anon como secreto JWT.

## 3. Migraciones: ejecutar localmente antes de publicar

Confirmar primero que `backend/.env` apunta al proyecto Supabase elegido. Desde PowerShell:

```powershell
Set-Location C:\PRACTICAPROFESIONAL\backend
npx.cmd prisma migrate status
```

Si no hay migraciones pendientes, no hay nada que aplicar. Si hay pendientes, revisar
la salida y seguir las condiciones de las migraciones. En una base con datos, antes
de `202609030001_period_administration` ejecutar `npm.cmd run db:verify-periods`;
debe terminar correctamente. No usar `migrate reset`.

```powershell
npm.cmd run db:migrate:deploy
npm.cmd run db:verify-deployment
```

La imagen Railway no contiene el CLI de Prisma: estos comandos se ejecutan en la
estación local, no se configuran como Start Command ni Pre-deploy Command.

## 4. Preparar el proyecto de Vercel

Importar el mismo repositorio en Vercel. Seleccionar:

| Campo | Valor |
| --- | --- |
| Root Directory | `frontend` |
| Framework | Angular |
| Node.js | 24.x |
| Install Command | `npm ci` |
| Build Command | `npm run config:runtime && npm run build -- --configuration production` |
| Output Directory | `dist/frontend/browser` |

Si todavía falta la URL de Railway, conservar la pantalla de configuración y
completar primero el paso 5. No desplegar con una URL inventada.

## 5. Railway: un servicio Docker

En el servicio conectado al repositorio:

| Campo | Valor |
| --- | --- |
| Root Directory | raíz del repositorio; vacío o `/` |
| Variable `RAILWAY_DOCKERFILE_PATH` | `deploy/docker/railway-demo.Dockerfile` |
| Custom Build Command | vacío, lo realiza Docker |
| Custom Start Command | vacío, lo realiza Docker |
| Pre-deploy Command | vacío |
| Healthcheck Path | `/api/health/ready` |
| Healthcheck Timeout | 300 segundos |
| Réplicas | 1 |
| Restart Policy | On Failure |

No seleccionar `backend` como Root Directory: los COPY del Dockerfile parten de la
raíz. Tampoco usar el Dockerfile institucional: su última etapa es un migrador.

En Variables → Raw Editor, copiar `deploy/config/railway.env.example` y reemplazar
TODOS los marcadores. Para `DATABASE_URL`, copiar el valor runtime ya comprobado
de `backend/.env`. No hace falta subir `DIRECT_URL` a Railway.

Generar un token privado para `METRICS_BEARER_TOKEN` en la terminal local:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Si aún no se conoce el dominio Vercel, para este primer arranque se puede usar el
origen HTTPS del servicio Railway en `CORS_ORIGINS` y su URL `/?auth=invite` para
`AUTH_INVITATION_REDIRECT_URL`. Es un valor temporal real que se reemplaza en el
paso 7 antes de probar login e invitaciones.

Settings → Networking → Public Networking → Generate Domain; Target Port: `3000`.
Conservar la URL real `https://NOMBRE.up.railway.app`. Aplicar variables y desplegar.
Los logs deben mostrar tanto `SIGVITS API listening` como `Export worker started`.

Comprobar en el navegador:

- `https://NOMBRE.up.railway.app/api/health` → `status: ok`.
- `https://NOMBRE.up.railway.app/api/health/ready` → `status: ready`.

El healthcheck de la API verifica conectividad de base de datos, no sustituye la
verificación de migraciones ni la prueba de exportaciones.

## 6. Vercel: variables y deploy

Agregar en Production (y Preview si se utiliza):

| Variable | Valor |
| --- | --- |
| `SIGVITS_API_URL` | `https://NOMBRE.up.railway.app/api` |
| `SUPABASE_URL` | `https://PROJECT_REF.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | clave pública publishable o anon |

No subir `DATABASE_URL`, `AUTH_ADMIN_SECRET` ni `METRICS_BEARER_TOKEN` a Vercel.
Desplegar y copiar el dominio de producción real que Vercel asigne. Si se cambian
variables después, ejecutar Redeploy para regenerar la configuración pública.

## 7. Conectar el dominio definitivo

En Railway, actualizar:

```dotenv
CORS_ORIGINS=https://DOMINIO-REAL.vercel.app
AUTH_INVITATION_REDIRECT_URL=https://DOMINIO-REAL.vercel.app/?auth=invite
```

El origen CORS no lleva `/api`, rutas ni barra final. Si se conserva desarrollo local,
usar una lista explícita separada por comas. Aplicar cambios y redeploy.

En Supabase → Authentication → URL Configuration:

- Site URL: `https://DOMINIO-REAL.vercel.app`.
- Redirect URLs: `https://DOMINIO-REAL.vercel.app/?auth=invite` y
  `https://DOMINIO-REAL.vercel.app/?auth=recovery`.
- Conservar las URL locales existentes si siguen utilizándose.

## 8. Usuarios y prueba final

Usar una cuenta institucional existente del mismo proyecto Supabase. Crear una cuenta
en Authentication → Users no le asigna automáticamente permisos de SIGVITS.

Solo si la base es nueva y no hay ningún usuario institucional: preparar catálogos
según el README del backend, crear el usuario en Supabase Auth y ejecutar localmente
`npm.cmd run db:bootstrap-admin` con `BOOTSTRAP_ADMIN_ISSUER`, `BOOTSTRAP_ADMIN_SUBJECT`
(UUID de Auth), `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_NAME`. No ejecutar este
bootstrap sobre una instalación existente: está diseñado para rechazarla.

Comprobar login, navegación con recarga, consulta autorizada y solicitud/descarga de
una exportación. Para invitaciones por correo hace falta verificar también el SMTP
del proyecto; ver `runbook-invitaciones-y-recuperacion.md`.

## Límites de esta demo

API y worker comparten disco temporal dentro de un solo contenedor. Los Excel/PDF
generados se pierden al reiniciar o redesplegar; los datos PostgreSQL permanecen en
Supabase. Descargar las exportaciones durante la demostración. No usar múltiples
réplicas ni dos servicios separados con esta configuración de archivos.

El worker consulta cada 10 segundos para reducir consumo. Railway consume créditos
mientras los procesos están activos; no se garantiza que el crédito alcance hasta
una fecha determinada. Verificar saldo antes de la presentación. Usar solo Trial/Free.

Referencias: [Dockerfiles Railway](https://docs.railway.com/builds/dockerfiles),
[Healthchecks Railway](https://docs.railway.com/deployments/healthchecks),
[Prisma y Supabase](https://supabase.com/docs/guides/database/prisma).
