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

## Despliegue en staging

Desde la raíz del repositorio:

```powershell
$compose = @('-f','deploy/compose.yaml','-f','deploy/compose.staging.yaml')
docker compose --env-file deploy/config/staging.env @compose config --quiet
docker compose --env-file deploy/config/staging.env @compose build --pull
docker compose --env-file deploy/config/staging.env @compose up --detach --wait --wait-timeout 180
docker compose --env-file deploy/config/staging.env @compose ps
```

Comprobar `GET /api/health` y `GET /api/health/ready`. Ejecutar verificación de despliegue, smoke
autenticado, UAT, carga y simulacro de recuperación. Conservar logs, métricas, hashes de artefactos,
SBOM y acta en un repositorio de evidencia con acceso restringido.

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
