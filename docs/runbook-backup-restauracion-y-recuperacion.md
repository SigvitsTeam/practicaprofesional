# Runbook de backup, restauración y recuperación

## Objetivos que debe aprobar la institución

Definir RPO, RTO, retención, cifrado, residencia y responsables antes de producción. Un backup no se
considera válido hasta restaurarlo, verificar integridad y ejecutar smoke sobre la copia. Para Supabase,
los backups administrados/PITR complementan, pero no sustituyen, el ensayo lógico independiente.

## Backup lógico

Use una versión de `pg_dump` igual o posterior a la versión mayor del servidor y una `DIRECT_URL` de
sesión. Para hosts remotos, el módulo fuerza `sslmode=require` si falta y rechaza modos que degradan
TLS; use `verify-full` con CA institucional cuando esté disponible. El script no elimina respaldos,
no imprime credenciales y produce formato custom, SHA-256 y manifiesto sin secretos:

```powershell
$env:DIRECT_URL = '<conexion directa o pooler de sesion con sslmode=require>'
./tools/database/Backup-Postgres.ps1 -OutputDirectory D:\Respaldos\SIGVITS
Remove-Item Env:DIRECT_URL
```

Copiar el `.dump`, `.sha256` y `.manifest.json` a almacenamiento cifrado e inmutable. Probar lectura
del catálogo con `pg_restore --list`. La rotación/retención se realiza en el sistema de backup, con
aprobación y legal hold; el script deliberadamente no borra archivos.

## Restauración ensayada

Crear una base PostgreSQL/PostGIS vacía y aislada, con roles `anon` y `authenticated`. La URL nunca
debe apuntar al origen. El archivo `.sha256` es obligatorio: sin él la restauración se detiene. El
script compara además el manifiesto cuando existe, valida SHA-256, exige destino sin tablas, restaura
en una transacción y registra evidencia:

```powershell
$env:RESTORE_DATABASE_URL = '<base vacia aislada con sslmode=require>'
./tools/database/Restore-Postgres.ps1 `
  -BackupFile D:\Respaldos\SIGVITS\sigvits_20260826T120000Z.dump `
  -ConfirmIsolatedTarget
Remove-Item Env:RESTORE_DATABASE_URL
```

Después, apuntar temporalmente API/worker de staging a la copia, ejecutar `db:verify-deployment`,
smoke autenticado, conteos de control y descarga de exportación. Verificar RLS, auditoría, zona horaria,
secuencias, PostGIS y que no se enviaron invitaciones/correos desde el entorno restaurado.

## Recuperación de API y worker

Antes del simulacro, solicitar una exportación de prueba y confirmar que está pendiente/procesando.
El siguiente comando sólo acepta un archivo marcado como staging, reinicia API/worker, espera sus
healthchecks y conserva estado/logs:

```powershell
./tools/recovery/Invoke-ServiceRecoveryDrill.ps1 `
  -EnvironmentFile deploy/config/staging.env `
  -ConfirmStaging
```

Al finalizar, verificar que el trabajo se publicó una sola vez, que el artefacto abre, que no aumentó
indefinidamente el número de intentos y que la auditoría conserva una única transición efectiva.

## Evidencia mínima

- hora, operador, versión de cliente/servidor, tamaño y SHA-256;
- almacenamiento y política de cifrado/retención;
- RPO/RTO medidos, no estimados;
- resultado de restauración, migraciones, RLS y smoke;
- estado del trabajo antes/durante/después del reinicio;
- hallazgos, riesgo residual, responsable y fecha de corrección.
