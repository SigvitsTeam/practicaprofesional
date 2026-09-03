# QA de administración mensual — 2026-09-03

## Resultado local

| Verificación | Resultado |
| --- | --- |
| `backend: npm run check` | Formato, TypeScript, ESLint, 239 pruebas unitarias, 40 pruebas API y builds API/worker aprobados |
| `frontend: npm run check` | Formato, ESLint, 160 pruebas y build de producción aprobados |
| `frontend: npx tsc --noEmit -p tsconfig.spec.json` | Aprobado |
| `backend: npm run db:validate` | Esquema Prisma válido |
| `backend: npm run db:verify-periods` | Solo lectura sobre base configurada: cero grupos duplicados y cero meses inválidos |
| PostgreSQL real del módulo | Seis pruebas aprobadas en una instancia temporal local, con conexiones separadas |

Las pruebas PostgreSQL verificaron creación concurrente idempotente, una sola apertura
y auditoría frente a solicitudes simultáneas, rollback de apertura si falla la auditoría,
rechazo por semanas inactivas, unicidad mensual/estado inicial bloqueado y asignación
del permiso únicamente a los dos roles nacionales.

Las pruebas de interfaz comprueban que la confirmación se muestra **después** del renderizado
de Angular, enfoca el motivo, no se cierra con Escape mientras se guarda, exige confirmación
y no anuncia éxito cuando el servidor devuelve un conflicto.

## Alcance y límites de la evidencia

Docker Desktop no respondió a las consultas del motor. Se utilizó PostgreSQL 18 temporal
en `127.0.0.1:55437/sigvits_qa_periods`, sin leer variables de conexión institucionales.
Como esa instalación no tiene PostGIS, el esquema temporal incluyó sólo las tablas del
módulo, extraídas del DDL original de las migraciones, y la nueva migración completa.
Esto prueba las transacciones del módulo; **no equivale a probar todas las migraciones,
RLS y módulos del sistema completo con PostGIS**. La suite está incluida en el workflow
existente de PostgreSQL/PostGIS y debe pasar allí antes del despliegue institucional.

El reporte JSON está en `evidence/periods-qa-20260903/postgres-results.json` (evidencia local,
no versionada). Se detuvo el clúster temporal y se eliminaron únicamente sus datos
sintéticos; se conservaron reporte, log y script de preparación. El servicio PostgreSQL
existente y los estados de los períodos institucionales no se modificaron en esa primera fase.

## Pendientes para activación

- Ejecutar el workflow completo PostgreSQL/PostGIS sobre esta versión.
- Revisar y aplicar `202609030001_period_administration` mediante el despliegue autorizado.
- Reiniciar servicios y renovar sesión para obtener el nuevo permiso.
- Completar UAT institucional por rol y aprobar expresamente qué mes debe abrirse.

La migración no abre ni cierra meses existentes. Este resultado no constituye una
certificación del sistema al 100 % ni una autorización para abrir un período nacional.

## Actualización: apertura anual solicitada por el usuario

Posteriormente el usuario pidió explícitamente dejar abiertos todos los meses mostrados
de 2026. Se implementó una operación anual que conserva cierres oficiales y controla las
doce versiones en una sola transacción, con una auditoría por mes cambiado.

- Backend: 240 pruebas unitarias y 40 de API; formato, lint, tipos y builds aprobados.
- Frontend: 162 pruebas; formato, lint y build de producción aprobados.
- PostgreSQL temporal: ocho pruebas del módulo aprobadas, incluidas concurrencia anual,
  rollback completo, idempotencia y protección de cierres oficiales. Sigue siendo QA
  aislado del módulo; no sustituye la suite integral con PostGIS.
- Comprobación previa institucional: once meses bloqueados, agosto abierto, cero cierres
  oficiales y semanas activas para todo 2026.
- Operación autorizada: once meses abiertos y once auditorías. Verificación posterior:
  enero a diciembre de 2026 en `ABIERTO`. No se modificaron años diferentes ni datos clínicos.
- La auditoría identifica mantenimiento con actor nulo y request ID
  `maintenance-open-2026-bf49edde-9ae9-4a6e-acc8-3d708ee50ad1`; no se suplantó una cuenta del sistema.

Evidencia local: `evidence/open-2026-before.json`, `evidence/open-2026-after.json` y
`evidence/periods-qa-20260903/postgres-annual-results.json`. La apertura no aplica por sí
misma la migración pendiente de permisos: esa migración sigue siendo necesaria para
activar las nuevas acciones administrativas a través de la interfaz institucional.
