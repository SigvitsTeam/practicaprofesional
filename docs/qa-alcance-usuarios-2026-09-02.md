# QA — Rol y alcance del formulario de usuarios

## Defecto y corrección

El formulario sugería un alcance al cambiar el rol, pero mantenía disponibles
todos los tipos, incluidos los incompatibles. Supervisor podía conservar
NACIONAL al seleccionarse después de Admin Central. El territorio se asignaba
automáticamente al primer registro, incluso si estaba inactivo.

La interfaz ahora utiliza una política declarativa alineada con
`ManagedUsersUseCase`: restringe las opciones, bloquea el tipo cuando es fijo,
cambia la etiqueta territorial y exige seleccionar un destino activo devuelto
por el catálogo autorizado. Cambiar rol o tipo limpia el destino anterior.
El alcance nacional no utiliza un ID territorial ficticio. La edición resuelve
el identificador por tipo de asignación y conserva la versión esperada.

El backend conserva sus reglas de jerarquía, territorio y compatibilidad.
No se ampliaron permisos ni se modificaron la base de datos o usuarios reales.
Digitador de Coordinación conserva el alcance ESTABLECIMIENTO admitido por el
contrato actual; esta corrección no introduce asignación múltiple ni municipal.

## Evidencia local

- 12 regresiones iniciales fallaron contra el formulario anterior.
- 17 pruebas DOM del formulario corregido aprobadas: tipos permitidos,
  transiciones, etiquetas, selección explícita, territorios activos,
  restricciones regionales, payloads manipulados, catálogo vacío y edición.
- 56 casos nuevos de compatibilidad rol/tipo en creación y cambio de acceso
  aprobados; la suite de administración de usuarios totaliza 65 pruebas.
- Frontend `npm run check`: formato, lint, 98 pruebas y build productivo aprobados.
- Frontend `npx tsc --noEmit -p tsconfig.spec.json`: aprobado.
- Backend `npm run check`: formato, tipado, lint, 207 pruebas unitarias,
  39 HTTP E2E y builds de API/worker aprobados.
- `git diff --check`: aprobado.

Total ejecutado en las suites completas: **344 pruebas**. Los casos del
formulario utilizan la plantilla Angular real con APIs simuladas y datos
sintéticos. No se reejecutó la suite PostgreSQL: no cambió persistencia.
La restricción SQL existente mantiene un único identificador territorial
compatible con el tipo de asignación.

## Límite de la verificación

El navegador disponible mostró el login institucional, sin una sesión
autenticada. No se creó ni modificó ningún perfil para la comprobación visual.
Queda pendiente la aceptación con una sesión institucional real. Esto no
certifica carga ni preparación de producción.
