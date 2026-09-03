# PostgreSQL QA aislado

Esta suite ejecuta los repositorios reales contra PostgreSQL/PostGIS. Nunca lee
`DATABASE_URL`, `DIRECT_URL` ni archivos `.env`. Exige `QA_DATABASE_URL` explícita,
host loopback y nombre de base `sigvits_qa*`. Rechaza parámetros de conexión que
puedan cambiar el host o la base después de validar la URL.

Requisitos: instancia desechable, migraciones aplicadas, roles `anon` y
`authenticated` creados para dichas migraciones y usuario de QA con permisos
para los fixtures (el servicio efímero de CI usa su propietario). No ejecutar
contra una copia de información clínica ni contra una base institucional.

Desde `backend`, con PowerShell:

```powershell
$env:QA_DATABASE_URL = 'postgresql://qa_user:change-me@127.0.0.1:55432/sigvits_qa_concurrency'
npm run test:postgres:qa
```

Sustituya `qa_user` y `change-me` únicamente por las credenciales de la instancia
desechable de QA; no use las del sistema institucional.

Las barreras de prueba esperan SELECT reales dentro de transacciones separadas;
después permiten que la operación competidora confirme primero. Así se comprueba
el aislamiento PostgreSQL sin carreras aleatorias ni pausas temporizadas:

- Numeración histórica tras invalidación ITS1.
- Captura concurrente con preparación inicial y recálculo de borrador.
- Envío concurrente con preparación, en ambos órdenes de confirmación.
- Captura concurrente con envío.
- Dos preparaciones iniciales simultáneas y unicidad de la versión publicada.
- Exclusividad de los claims de exportación y reclamación de intentos vencidos.
- Rechazo de finalización/fallo por un worker cuyo intento ya fue reemplazado.
- Recuperación de intentos agotados con auditoría única, sin reintentos y con
  máximo de 25 trabajos por ejecución.
- Creación, corrección y anulación válidas para hombre/mujer con auditoría.
- Rechazo transaccional de patologías incompatibles, embarazo masculino y
  cambios de sexo o catálogo que invalidarían diagnósticos existentes.
- Creación idempotente y concurrente del calendario mensual/epidemiológico.
- Apertura mensual con bloqueo de fila, versión optimista y una sola auditoría
  frente a solicitudes simultáneas.
- Apertura anual atómica: rollback ante calendario/auditoría inválidos, un solo ganador
  concurrente, reintentos sin auditorías duplicadas y conservación de cierres oficiales.

La suite del worker exige una cola QA vacía y ningún worker externo conectado a
esa base: `claimNext` y la recuperación operan sobre la cola global por diseño.

Los fixtures son sintéticos y cada ejecución crea sus propios UUID. La limpieza
borra únicamente registros asociados a esos IDs, sin `TRUNCATE`, reinicios del
esquema ni resets. No se ocultan errores como skips: la falta de PostgreSQL o de
`QA_DATABASE_URL` hace fallar el comando. El workflow
`.github/workflows/postgres-concurrency.yml` configura una base desechable nueva
y conserva el resultado JSON como evidencia.
