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
7. Creación de redes y composición municipal versionada con auditoría y concurrencia segura.
8. Transiciones territoriales protegidas por dependencias, jerarquía, auditoría y concurrencia.
9. Gestión directa de estados de regiones, municipios y establecimientos desde la interfaz administrativa.
10. Suspensión, reactivación e inactivación de redes con bloqueo optimista, auditoría y conservación de membresías históricas.
11. Anulación auditada de ITS-1 y bloqueo de correcciones/anulaciones cuando el ITS-2 ya fue enviado o aprobado.
12. Analítica territorial agregada por región, municipio y establecimiento, filtrada por alcance y sin consultar ITS-1 individual.
13. Mapa productivo conectado a catálogo y versiones ITS-2 vigentes; los datos simulados quedan limitados al modo demo.
14. Carga diferida de pantallas operativas y administrativas para mantener el bundle inicial bajo presupuesto.
15. Panel de inicio productivo con KPIs y prioridades calculados desde la analítica territorial vigente; mocks limitados al modo demo.
16. Administración territorial secundaria conectada al catálogo y asignaciones reales: árbol, KPIs, ficha municipal, geografía, responsables, preparación y alertas sin valores ficticios.
17. Historial territorial conectado a auditoría paginada, con permiso específico, alcance regional validado y sin exponer datos previos/nuevos sensibles.
18. Vinculación administrativa de identidad externa por `issuer` configurado y `subject` inmutable, con permiso específico, activación atómica, bloqueo optimista, unicidad, auditoría e idempotencia.
19. Cola persistente de exportaciones con trabajos propios, alcance autorizado, idempotencia, estados, intentos, RLS, auditoría e interfaz productiva sin archivos ficticios.
20. Worker independiente con reclamación atómica `SKIP LOCKED`, recuperación de trabajos estancados, reintentos acotados, generación territorial XLSX/PDF, publicación idempotente, descarga exclusiva del solicitante, vencimiento y auditoría.
21. Generador ITS-2 mensual para establecimiento con XLSX estructurado, PDF sobre plantilla oficial, alcance validado, neutralización de fórmulas y ejecución fuera del proceso HTTP.
22. Generadores de consolidados municipal, regional y nacional en XLSX/PDF, construidos desde versiones persistidas, con trazabilidad de fuentes, validación exacta de alcance y sin mutar el flujo de aprobación.
23. Generador ITS-1 individual en XLSX de solo lectura y PDF oficial, con solicitud separada, permiso individual, alcance de establecimiento, revalidación al descargar y auditoría posterior al servicio exitoso.
24. Perfil institucional autenticado desde backend con roles/permisos/alcance vigentes, selector limitado a roles realmente asignados, identidad real en cabecera y eliminación de filtros, avisos y contexto ITS-1 ficticios en producción.
25. Analítica de Redes compuesta desde agregados municipales persistidos, con filtros efectivos, consolidado sin ITS-1 individual e historial administrativo paginado y restringido por alcance regional.
26. Período operativo mensual resuelto dinámicamente en captura ITS-2, bandejas, consolidados, mapas y Redes; acciones visuales sin implementación retiradas de producción.
27. Invitación institucional por correo desde backend mediante API administrativa de Supabase, con secreto exclusivo de servidor, timeout, vínculo del identificador inmutable, activación opcional, control de jerarquía/alcance y auditoría transaccional.
28. Escenario k6 parametrizable hasta 1,000 usuarios virtuales con umbrales de error/p95 y matriz UAT de extremo a extremo, recuperación, privacidad, exportaciones, restauración y evidencia de release.
29. Coordenadas reales para los 12 establecimientos del piloto, con fuente trazable, mapa geográfico proporcional y distinción explícita entre GPS institucional validado y referencia pública comunitaria.
30. Selectores productivos de región, municipio y establecimiento para solicitar ITS-2 y consolidados especializados desde alcance autorizado, sin botones ficticios.
31. Comparación anual persistente por períodos o indicadores, rangos acotados, XLSX/PDF agregado, auditoría, reintentos y procesamiento por worker independiente.
32. Migraciones aplicadas y verificación automatizada satisfactoria: 29 tablas con RLS forzado, cero tablas públicas, usuarios piloto, JWKS, pooler y cobertura geográfica 12/12.
33. Smoke autenticado de comparación anual completado de extremo a extremo (cola, worker y descarga XLSX válida); la entrega binaria usa `StreamableFile` para impedir serialización JSON y archivos corruptos.

### Siguiente ejecución

1. Ejecutar k6, UAT por rol, restauración de backup y prueba de recuperación API/worker en un ambiente de staging aislado; conservar métricas y acta como evidencia de salida.
