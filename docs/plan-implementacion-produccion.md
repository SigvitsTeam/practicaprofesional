# Plan de implementación hacia producción

## Objetivo

Completar SIGVITS como sistema institucional verificable, seguro y operable bajo carga. La
capacidad no se dará por cumplida por diseño o intuición: cada objetivo de rendimiento deberá
demostrarse en un ambiente equivalente a producción con datos y patrones de uso representativos.

## Definición global de terminado

Una capacidad está terminada cuando cumple, como mínimo:

- reglas de negocio en NestJS y persistencia transaccional en PostgreSQL;
- autorización por permiso, territorio y nivel de dato;
- validación de entrada, errores HTTP estables y auditoría sin datos sensibles innecesarios;
- control de concurrencia o idempotencia donde una repetición o carrera pueda corromper estado;
- pruebas unitarias, de integración y de contrato para rutas críticas;
- métricas, logs correlacionados y procedimiento de recuperación;
- documentación operativa y aceptación del rol institucional correspondiente.

## Fases

### Fase 1 — Núcleo del piloto

1. Consulta paginada y corrección ITS-1 con bloqueo optimista.
2. Anulación controlada, motivo obligatorio y auditoría.
3. Reglas de edición según periodo y estado del ITS-2.
4. Flujo ITS-2 completo: establecimiento, municipio, región, central y cierre.
5. Versionamiento inmutable de reportes y observaciones por cada nivel.

**Salida:** un mes puede capturarse, corregirse, consolidarse, revisarse y cerrarse de extremo a
extremo sin intervención directa en base de datos.

### Fase 2 — Administración institucional

1. CRUD transaccional de regiones, municipios, establecimientos y redes.
2. Vigencia histórica de asociaciones Red–Municipio.
3. Usuarios, roles, permisos y asignaciones territoriales con mínimo privilegio.
4. Catálogos, calendarios epidemiológicos, periodos y reaperturas justificadas.
5. Bitácora consultable de acciones sensibles.

**Salida:** SuperAdmin y SuperAdmin Regional pueden operar su alcance sin datos simulados.

### Fase 3 — Análisis y documentos

1. APIs agregadas para dashboards, filtros, consolidados y rankings.
2. Mapa Leaflet con geometrías versionadas y supresión de conteos sensibles.
3. Exportación Excel/PDF asíncrona mediante cola de trabajos.
4. Reportes semanales, trimestrales, semestrales, anuales y evaluación comparativa.
5. Descargas autorizadas, con vencimiento y auditoría.

**Salida:** toda cifra visible o exportada es reproducible desde datos persistidos y su alcance.

### Fase 4 — Plataforma de alta concurrencia

1. Índices validados con `EXPLAIN ANALYZE`, consultas acotadas y paginación por cursor.
2. API sin estado, pool de conexiones dimensionado y límites de tiempo explícitos.
3. Caché solo para catálogos/agregados seguros, con invalidación definida.
4. Idempotencia en comandos, bloqueo optimista y transiciones atómicas.
5. Cola para PDF/Excel y otras tareas costosas; nunca bloquear workers HTTP con procesos largos.
6. Rate limiting por identidad/ruta y límites de tamaño.
7. Métricas RED, trazas, logs estructurados, alertas y tableros operativos.
8. Backups, restauración ensayada, migraciones compatibles y despliegue progresivo.
9. Pruebas de carga, estrés y resistencia con umbrales aprobados.

**Umbrales iniciales a validar:** cero errores de integridad; tasa de error menor a 1%; p95 menor a
500 ms en lecturas comunes y menor a 1 s en escrituras, excluyendo trabajos asíncronos. La cantidad
de usuarios concurrentes se fijará con la proyección institucional y se certificará con pruebas.

### Fase 5 — Preparación del piloto

1. UAT por cada rol y matriz de trazabilidad requisito–prueba.
2. Revisión de privacidad, amenazas y permisos efectivos.
3. Accesibilidad, compatibilidad y rendimiento del frontend.
4. Manuales, soporte, capacitación, continuidad y respuesta a incidentes.
5. Carga controlada de catálogos oficiales y simulacro de cierre mensual.

## Puertas de calidad

- Todo cambio: formato, lint, pruebas, compilación y revisión de migración.
- Todo endpoint: autenticación, autorización positiva/negativa, validación y contrato de error.
- Toda transición: prueba de repetición, carrera y rollback.
- Toda consulta de colección: límite máximo, orden estable e índice correspondiente.
- Todo release: smoke test, rollback practicable y evidencia de observabilidad.

## Orden de ejecución inmediato

### Completado en código

1. Consulta/corrección ITS-1 paginada, con bloqueo optimista e integración Angular.
2. Flujo ITS-2 desde establecimiento hasta municipio, región y nivel central.
3. Consolidado nacional, cierre oficial del período y reapertura justificada.
4. Catálogo real de regiones, municipios y establecimientos con alcance y auditoría.
5. Alta y consulta de perfiles institucionales con rol, vigencia y alcance territorial atómicos.
6. Suspensión/reactivación y cambios versionados de rol/alcance con bloqueo optimista.

### Siguiente ejecución

1. Completar actualización, activación e inactivación de territorios y redes.
2. Completar invitación y vinculación segura con el proveedor de identidad externa.
3. Implementar anulación ITS-1 y reglas adicionales de bloqueo por reporte enviado.
4. Sustituir datos simulados restantes en tableros, mapas y bandejas.
5. Aplicar las siete migraciones y ejecutar smoke/UAT sobre PostgreSQL de staging.
