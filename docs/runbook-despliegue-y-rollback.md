# Runbook de despliegue y rollback

## Alcance y supuestos

La composición local levanta PostgreSQL/PostGIS, migrador, API, worker y frontend. API y worker
comparten únicamente el volumen de artefactos; PostgreSQL está en una red interna. Los puertos se
publican en `127.0.0.1` para que TLS y acceso público queden a cargo de un proxy o balanceador.

Para miles de usuarios, las mismas imágenes deben ejecutarse en una plataforma con balanceo,
réplicas de API sin estado, almacenamiento compartido duradero y pool de PostgreSQL dimensionado.
Docker Compose es el entorno reproducible de staging/operación local, no sustituye un orquestador.

Requisitos: Docker Engine con Compose v2, registry con tags inmutables, DNS/TLS, proyecto de
identidad, seis secretos y una estación administrativa con `pg_dump`, `pg_restore` y `psql`.

## Preparación única

1. Copiar `deploy/config/staging.env.example` a `deploy/config/staging.env` y reemplazar dominios y
   valores públicos. Para producción usar `production.env.example` y un tag de release inmutable.
2. Crear `deploy/secrets` fuera de Git y generar archivos sin salto de línea:
   `postgres_password.txt`, `runtime_db_password.txt`, `database_url.txt`, `direct_url.txt`,
   `auth_admin_secret.txt` y `metrics_bearer_token.txt`. Las contraseñas y el token de métricas deben
   ser aleatorios; los dos últimos secretos deben tener al menos 32 caracteres.
3. Restringir lectura de los archivos al operador/servicio. `database_url.txt` usa
   `sigvits_runtime` y el pooler; su contraseña debe coincidir con `runtime_db_password.txt`.
   `direct_url.txt` usa el propietario sólo para migraciones y respaldo. El rol runtime tiene DML y
   `BYPASSRLS` —necesario porque la API es la única barrera y las tablas fuerzan RLS—, pero no tiene
   propiedad, superusuario, creación de roles, DDL ni creación de bases.
4. Verificar que `AUTH_ISSUER`, JWKS, CORS, redirect y las URL públicas sean HTTPS y correspondan al
   mismo ambiente. `database_url.txt` y `direct_url.txt` deben declarar `sslmode=require`,
   `verify-ca` o `verify-full` si el host no es el PostgreSQL interno de Compose. El entrypoint
   rechaza conexiones remotas sin TLS. Nunca colocar `service_role` en variables del frontend.
5. En una base ya creada, un DBA debe crear/rotar `sigvits_runtime` y aplicar los mismos grants que
   `deploy/postgres/init/10-runtime-role.sh`; los scripts de init sólo corren al crear un volumen.
6. La imagen prepara `/var/lib/sigvits/exports` para el usuario `node` (UID/GID 1000), de modo que
   un volumen nuevo herede permisos de escritura. Para volúmenes existentes o bind mounts,
   verificar propietario y permisos antes del despliegue; el entrypoint falla con un mensaje
   explícito si `EXPORT_STORAGE_DIRECTORY` no es escribible. No usar `chmod 777` ni borrar el
   volumen para resolver permisos: conservar los artefactos vigentes y ajustar únicamente el
   directorio validado mediante el operador de almacenamiento.

## Despliegue en staging

Desde la raíz del repositorio:

```powershell
$compose = @('-f','deploy/compose.yaml','-f','deploy/compose.staging.yaml')
docker compose --env-file deploy/config/staging.env @compose config --quiet
docker compose --env-file deploy/config/staging.env @compose build --pull --no-cache
docker compose --env-file deploy/config/staging.env @compose up --detach --wait --wait-timeout 180
docker compose --env-file deploy/config/staging.env @compose ps
```

Comprobar `GET /api/health` y `GET /api/health/ready`. Ejecutar verificación de despliegue, smoke
autenticado, UAT, carga y simulacro de recuperación. Conservar logs, métricas, hashes de artefactos,
SBOM y acta en un repositorio de evidencia con acceso restringido.

Antes de promover una imagen frontend, ejecutar el smoke reproducible (reemplazar
la referencia por el tag local o digest descargado del candidato):

```powershell
node tools/qa/verify-frontend-container.mjs --image sigvits-frontend:ci --evidence evidence/container-security/frontend-smoke.json
```

El comando crea un contenedor propio sin privilegios, con raíz de solo lectura,
puerto aleatorio limitado a loopback y configuración ficticia de QA. Comprueba
arranque Nginx, cabeceras, caché de assets y configuración runtime, y elimina
únicamente ese contenedor al terminar. No realiza login ni comprueba la identidad
real del ambiente; esas comprobaciones siguen siendo parte del smoke autenticado.

Las imágenes finales de API, worker y migrador no incluyen npm/npx/Yarn globales.
El migrador arranca Prisma con Node directamente; para diagnósticos dentro de esa
imagen usar `node node_modules/prisma/build/index.js migrate status`. No reinstalar
gestores de paquetes en contenedores en ejecución. Para cada release, reconstruir
sin caché de capas, escanear las cuatro imágenes y revisar además los avisos de
Node/Nginx: los binarios de terceros no siempre quedan cubiertos por el inventario
del escáner. Registrar versión de herramienta y fecha de su base de vulnerabilidades.

## Promoción a producción

1. Congelar cambios y registrar commit, tag, digest OCI, SBOM, escaneo de imagen y resultado CI.
2. Confirmar backup verificado y restauración reciente dentro del RPO/RTO aprobado.
3. Confirmar compatibilidad hacia atrás de la migración. Se exige patrón expand/contract: primero se
   agregan estructuras compatibles; la eliminación se difiere hasta que no existan instancias viejas.
4. Promover por digest exactamente las imágenes certificadas; no reconstruir desde el tag. Definir
   `SIGVITS_API_IMAGE_REF`, `SIGVITS_WORKER_IMAGE_REF`, `SIGVITS_MIGRATOR_IMAGE_REF` y
   `SIGVITS_FRONTEND_IMAGE_REF` como referencias completas `registro/imagen@sha256:...`.
5. Ejecutar el despliegue en ventana aprobada y observar error rate, latencia, conexiones, locks,
   backlog/edad de exportaciones, CPU y memoria.
6. Completar smoke por rol y registrar decisión de continuidad antes de cerrar la ventana.

## Cambio a workers con fencing de intentos

No mezclar workers anteriores (que actualizan únicamente por id/estado) con los que verifican
id/estado/intento. El despliegue inicial de este cambio requiere una ventana coordinada:

1. Detener todas las réplicas antiguas con `SIGTERM` y una gracia suficiente para finalizar su
   exportación activa. El worker deja de reclamar al terminar el ciclo actual; esperar el mensaje
   `Export worker stopped` y confirmar que no quedan procesos o réplicas de la versión anterior.
2. Actualizar API y worker al mismo release certificado. La API debe reconocer claves de artefacto
   `.attempt-N.xlsx/pdf` antes de arrancar los nuevos workers. No borrar el volumen: la versión nueva
   mantiene lectura y expiración de claves anteriores.
3. Arrancar únicamente workers con fencing. Un intento interrumpido se reclama al vencer
   `EXPORT_JOB_STALE_MS` si conserva intentos disponibles; no reiniciar contadores manualmente.
4. Validar en staging una reclamación vencida: el intento viejo no puede completar/fallar el nuevo ni
   eliminar su archivo. Si muere el último intento, cada poll recupera como máximo 25 trabajos
   vencidos y los deja en `FALLIDO` con `EXPORT_ATTEMPTS_EXHAUSTED`. La transición y el evento
   `EXPORT_JOB_ATTEMPTS_EXHAUSTED` se guardan en la misma transacción sin datos clínicos; el contador
   permanece agotado y no vuelve a ejecutarse automáticamente. Revisar causa antes de solicitar
   una exportación nueva con otra clave de idempotencia.

El rollback también debe respetar este contrato: no volver a API/workers sin soporte de claves por
intento mientras existan archivos vigentes con ese formato. Usar un release compatible certificado
o mantener el procesamiento pausado hasta disponer de una corrección; no borrar datos para forzar
compatibilidad. Si falla la limpieza de un artefacto obsoleto, conservar logs y abrir seguimiento de
almacenamiento; todavía no existe una cola durable para reintentar esa eliminación.

## Señales para rollback

- readiness inestable o tasa de errores fuera del umbral durante cinco minutos;
- regresión de autorización/privacidad, corrupción, duplicidad o bloqueo sostenido;
- backlog del worker creciendo sin recuperación;
- p95 por encima del umbral certificado sin causa externa controlada.

El rollback de aplicación usa el tag inmutable anterior:

```powershell
./tools/release/Invoke-ReleaseRollback.ps1 `
  -PreviousReleaseTag '2026.08.0' `
  -EnvironmentFile deploy/config/production.env `
  -ConfirmProductionRollback
```

El script obtiene migrador, API, worker y frontend previos; ejecuta `prisma migrate deploy` de la
versión anterior, espera healthchecks y hace GET no mutantes sobre readiness de API y health del
frontend. Guarda por separado salida de migración, estado y resultado de smoke. **No revierte
migraciones**: la ejecución sólo confirma que no faltan migraciones conocidas por la versión. Si una
migración no es compatible hacia atrás, se detiene la salida; recuperar datos significa restaurar en
una base nueva y aislada, validar y realizar un cutover aprobado. Nunca ejecutar `pg_restore --clean`
sobre producción viva.

Si los puertos no son los predeterminados, pase `-ApiReadinessUrl` y `-FrontendHealthUrl`. El smoke
autenticado por rol sigue siendo una puerta manual posterior; el script de rollback sólo ejecuta
lecturas idempotentes para no mutar datos durante una contingencia.

## Cierre

Registrar hora, versión, responsables, métricas antes/después, incidencias, resultado de smoke y
evidencia. Rotar cualquier credencial expuesta durante el incidente y abrir acciones correctivas con
responsable y fecha.
