# QA: digitación municipal, Redes y aislamiento — 4 de septiembre de 2026

## Evidencia automatizada

| Comprobación | Resultado |
| --- | --- |
| Backend: formato, TypeScript, ESLint, builds API y worker | Aprobados |
| Unitarias backend | 252 aprobadas |
| HTTP E2E | 47 aprobadas |
| Frontend: formato, ESLint, TypeScript de tests y build productivo | Aprobados |
| Pruebas frontend | 167 aprobadas |
| PostgreSQL/PostGIS aislado | 76 aprobadas en 7 suites |
| Migraciones desde cero | 25 aplicadas sin error en QA |

Total: **542 pruebas aprobadas**. Las pruebas HTTP usan una identidad sintética; no son un
inicio de sesión real en Supabase. Las transacciones se prueban por separado contra PostGIS.
No se hizo una prueba de carga ni se certificó capacidad para miles de usuarios.

## Regresiones cubiertas

- Matriz de roles/alcances en alta y edición: digitador municipal o de establecimiento,
  rechazo de alcance regional/nacional. Formulario real envía sólo el identificador pertinente.
- Regiones padre no son concesiones regionales: consulta de catálogo sin municipios ni
  establecimientos hermanos; Redes devuelve sólo miembros autorizados y marca alcance limitado.
- Lectura municipal HTTP permitida, edición/creación/estado denegados (403), fechas imposibles
  y parámetros de alcance inyectados rechazados (400).
- Mes histórico conserva una asociación finalizada; retiro efectivo excluye ese día;
  fecha previa a creación no devuelve la red; alcance vacío falla cerrado.
- Dos solicitudes concurrentes de asociación sobre el mismo municipio: un único ganador,
  sin doble asociación ni red perdedora persistida.
- Lectura regional explícita conserva redes vacías y composición completa.
- Recarga asíncrona de Angular visible sin clic ni detección manual; respuestas atrasadas,
  error de nuevo período, salida de la pantalla y separación del borrador administrativo.
- Nuevas pruebas se suman a las existentes de sexo/patología, concurrencia ITS-2,
  trabajadores de exportación, calendario y seguridad de la URL de QA.

## Entorno de base de datos

Docker Desktop se inició en segundo plano. Contenedor creado exclusivamente para esta revisión:
`sigvits-qa-pilot-20260904`, imagen `postgis/postgis:17-3.5-alpine`, puerto loopback 55434,
base `sigvits_qa_pilot`. No se copió información institucional. Fixtures con UUID propios;
limpieza limitada a esos identificadores. Se conservaron los contenedores preexistentes.

Resultados PostgreSQL locales: `evidence/pilot-20260904/postgres-results.json` (ignorado por Git).
Aviso no bloqueante observado: uso concurrente de consultas `pg` dentro de una transacción
en pruebas existentes; no se actualizó a pg 9 ni se ocultó el aviso.

## QA visual aislado

Navegador integrado contra `tools/qa/serve-ui-preview.mjs`: datos sintéticos, escrituras
rechazadas por el proxy, ninguna invitación enviada. Se revisó Redes con rol municipal y
nombre largo, su aviso de alcance, filtros y pestaña de consolidado.

Corregidos el ancho mínimo del texto, el salto de línea del distintivo SOLO CONSULTA en móvil
y el fondo/contraste del aviso en modo oscuro. Las tablas anchas conservan desplazamiento
horizontal propio; no debe confundirse con un desbordamiento de toda la página.

| Ventana | Ancho cliente / documento | Superposiciones entre filtros de Redes |
| --- | --- | --- |
| 1366 × 900 | 1351 / 1351 px | 0 |
| 768 × 1024 | 753 / 753 px | 0 |
| 390 × 844 | 375 / 375 px | Aviso revisado visualmente, sin desbordamiento |
| 320 × 480 | 305 / 305 px | 0 |

Se restauró el tamaño del navegador tras comprobar los puntos de adaptación.
Los servicios temporales de QA se detuvieron al finalizar; el contenedor se conserva detenido.

## Límites de esta evidencia

Supabase sólo se consultó: 12 establecimientos activos de Puerto Cortés y 12 meses abiertos
en 2026. No se aplicaron migraciones institucionales, no se reasignaron usuarios y no se
modificó la red real. Respaldo completo detenido por protección del entorno; requiere
autorización específica para la posible copia de datos sensibles a la carpeta local backups.
Invitaciones/recuperación reales, exportación de Red, filtros adicionales, UAT completa,
carga y despliegue siguen en el [plan del piloto](plan-piloto-puerto-cortes-2026-09-04.md).
