# Entrega piloto Puerto Cortés — ejecución y pendientes

Fecha: 4 de septiembre de 2026. Alcance: municipio 0506, sus 12 establecimientos y
las redes institucionalmente confirmadas. No es una certificación del 100% del sistema.

## Lote 1: implementado y probado localmente

- Digitador: alta y edición permiten MUNICIPIO o ESTABLECIMIENTO; no permiten REGION
  ni NACIONAL. No se otorgan permisos de revisión/aprobación ni se cambian usuarios reales.
- Coordinación municipal: navegación y permiso de lectura de Redes, nunca administración.
- Autorización distingue regiones asignadas directamente de regiones padre de un municipio
  o establecimiento. La consulta de Redes y el catálogo no exponen territorios hermanos.
- Redes: fecha de consulta explícita, historial de asociaciones retiradas y subtotales
  municipales rotulados. No se inventa composición ni se agregan municipios al catálogo real.
- Altas/asociaciones rechazan vigencias superpuestas entre redes mediante comprobación
  transaccional serializable. Dos altas concurrentes tienen un único ganador en QA.
- Angular: actualización asíncrona, descarte de respuestas obsoletas, limpieza al fallar la
  recarga, cancelación al salir, bloqueo de doble envío y separación de carga/guardado.
- QA visual: corrección del aviso comprimido en móvil y contraste en modo oscuro.

Los cambios de aplicación requieren reiniciar/recompilar los servicios. El permiso municipal
requiere aplicar la migración nueva: todavía **no está activado en Supabase**.

## Criterio temporal de Redes

La consulta mensual usa la composición al último día del mes y los consolidados municipales
completos de ese mes, **sin prorratearlos por días**. La pantalla lo informa expresamente.
Un retiro con fecha D excluye la asociación desde D: intervalos de vigencia `[inicio, fin)`.
Así, un traslado efectivo el 25 de agosto aparece en la red anterior el 24 y en la nueva el 25.
El indicador de estado operativo representa el estado **actual**, no una reconstrucción histórica.

Las casillas administrativas cargan la composición vigente hoy por separado del período
consultado; el contenido histórico no debe convertirse accidentalmente en una orden de edición.
La política de corte mensual debe quedar ratificada en el acta UAT. No se modificaron fechas
institucionales existentes. Los cambios SQL directos de asociaciones siguen requiriendo control
administrativo: este lote añade el bloqueo de superposiciones a la API, no una exclusión SQL global.

## Orden de los siguientes bloques

| Prioridad | Trabajo pendiente | Criterio de aceptación |
| --- | --- | --- |
| P0 | Respaldo autorizado y despliegue de dos migraciones | Respaldo verificable; 25 migraciones aplicadas; 2026 conserva sus 12 meses abiertos |
| P0 | Invitaciones y recuperación reales | Secreto sólo en backend, redirecciones autorizadas, SMTP configurado; recepción y flujo completo en un buzón de prueba autorizado |
| P0 | UAT Puerto Cortés | Digitador municipal opera los 12 establecimientos; responsable sólo el suyo; coordinación revisa agregados; pruebas negativas fuera de alcance |
| P0 | Circuito ITS-1/ITS-2 y formatos | Captura por sexo, duplicados, cero producción, corrección/anulación, preparación, envío, devolución, revisión, consolidado y descarga verificados de extremo a extremo |
| P0 | Exportaciones de Red | Contrato, cola, worker, XLSX/PDF, trazabilidad de composición/mes y revalidación del alcance al descargar; sin ITS-1 individual |
| P1 | Filtros epidemiológicos reales | Patología, sexo, edad y clasificación coherentes entre consulta, mapa y exportación; no mostrar controles decorativos |
| P1 | Rangos temporales adicionales | Definir y probar salidas semanal/trimestral/semestral separadamente de la comparación anual |
| P1 | Edición de metadatos territoriales | Contratos y permisos acotados, unicidad, control de versión, auditoría y validación geográfica |
| P0 | Entorno de entrega | Frontend, API y worker disponibles; almacenamiento compartido durable; readiness, restauración, rollback y prueba de carga del piloto |
| Externo | Composición institucional de redes | Confirmar nombre/código/municipios/vigencias; no inferir Omoa por el código de la red |
| Externo | Coordenadas pendientes | Mantener como referencias los 10 puntos no validados hasta confirmación GPS; 2 validados actualmente |

Los filtros/rangos/edición no se consideran implementados por estar descritos en este plan.
Tampoco se considera probada la entrega de correo porque una API acepte una solicitud.

## Estado institucional observado, sólo lectura

- Puerto Cortés: 12 establecimientos, los 12 activos.
- Año 2026: 12 meses ABIERTO, cero duplicados e inconsistencias detectadas por el preflight mensual.
- Supabase: 23 migraciones aplicadas. Pendientes `202609030001_period_administration`
  y `202609040001_municipal_network_read`.
- Faltan localmente `AUTH_ADMIN_SECRET` y `AUTH_INVITATION_REDIRECT_URL`.
- El entorno rechazó el respaldo completo por posible copia de datos sensibles sin
  autorización explícita del contenido y destino. No se ejecutó el respaldo ni se aplicaron
  las migraciones institucionales. Solicitar autorización para respaldar en
  `C:\PRACTICAPROFESIONAL\backups`; mantener esos archivos fuera de Git.

Evidencia del lote: [QA de alcance y Redes](qa-piloto-redes-2026-09-04.md).
