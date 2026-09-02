# Optimización del acceso institucional — 2 de septiembre de 2026

## Resultado medido

Comparación de los repositorios de `HEAD` (`3a8835f7`) con los optimizados,
desde la misma máquina y proceso Node.js, utilizando la conexión configurada
a Supabase. Tres repeticiones alternadas antes/después, sin concurrencia de
carga, con el pool ya conectado. Valores en milisegundos:

| Operación | Antes (3 muestras) | Después (3 muestras) | Mediana antes → después | Consultas SQL antes → después |
| --- | --- | --- | --- | --- |
| Resolver perfil | 862 / 655 / 629 | 89 / 82 / 78 | 655 → 82 ms (−87,5 %) | 16 → 1 |
| Listar usuarios | 416 / 418 / 420 | 74 / 72 / 69 | 418 → 72 ms (−82,8 %) | 9 → 1 |

El listado tenía 5 registros. Se comparó el contenido completo antes/después:
igual en las tres repeticiones. Los 4 perfiles activos vinculados consultados
también conservaron sus roles, permisos y alcance (comparados como conjuntos).
La medición emitió únicamente tiempos, conteos y booleanos de equivalencia;
no imprimió credenciales, nombres, correos ni identificadores de personas.
No se crearon ni modificaron datos en Supabase.

Estos son tiempos de repositorio, **no del login completo ni una prueba de
carga**. Excluyen autenticación de contraseña en Supabase, descarga de JWKS,
HTTP, renderizado y carga de paneles. La base de datos continúa siendo remota
aunque NestJS y Angular se ejecuten en localhost. Red, arranque en frío y
volumen de datos pueden cambiar los resultados.

## Implementación

- Perfil: una consulta SQL parametrizada resuelve identidad, usuario activo,
  roles/asignaciones vigentes, permisos activos y expansión territorial.
  No se cachean permisos: cada petición protegida sigue consultando su estado.
- Se conservan los límites inclusivos de vigencia en fecha UTC y las reglas
  existentes para territorios explícitos y descendientes activos. Los padres
  de un establecimiento aportan contexto, no acceso a establecimientos vecinos.
- Usuarios: una consulta obtiene únicamente los campos del contrato público,
  la última asignación vigente y un booleano de identidad vinculada; no trae
  registros completos de identidad externa.
- Ajuste restrictivo: si un usuario tiene varias asignaciones regionales,
  un administrador regional solo recibe la última que esté dentro de su
  alcance. Antes se filtraba el usuario pero se podía mostrar otra asignación
  más reciente de una región distinta. Las operaciones de escritura conservan
  sus comprobaciones de autorización y concurrencia.
- Frontend: perfil y períodos se solicitan en paralelo. El catálogo no se
  publica ni la aplicación se habilita hasta que ambos resultados sean válidos.
  Los errores cancelan la otra petición; cerrar sesión, destruir la aplicación
  o cambiar de cuenta cancela solicitudes y evita conservar estado anterior.
- Logs: `durationMs` comienza en el middleware, antes de los guards, e incluye
  ahora su latencia. El interceptor no registra peticiones rechazadas antes de
  alcanzarlo; las métricas HTTP existentes siguen cubriéndolas. No se imprimen
  query strings.

Las consultas permanecen en la capa de infraestructura; no se cambió el
contrato HTTP, el esquema, el pool ni las dependencias. Los valores se vinculan
con `Prisma.sql`, sin concatenar parámetros dentro del SQL. La selección
correlacionada utiliza [LATERAL de PostgreSQL](https://www.postgresql.org/docs/17/queries-table-expressions.html#QUERIES-LATERAL).

## QA ejecutado

| Control | Resultado |
| --- | --- |
| Backend: formato, TypeScript y ESLint | Aprobados |
| Backend: unitarias | 211 aprobadas |
| Backend: HTTP E2E | 39 aprobadas |
| Backend: PostgreSQL real aislado | 59 aprobadas |
| Backend: compilaciones API y worker | Aprobadas |
| Frontend: formato, ESLint y TypeScript de tests | Aprobados |
| Frontend: tests | 107 aprobados |
| Frontend: compilación de producción | Aprobada |
| `git diff --check` | Aprobado |

Total: **416 pruebas**. Incluye 42 nuevas: 29 de lecturas de acceso en PostgreSQL,
9 de arranque paralelo/sesión en Angular y 4 de parametrización y medición HTTP.
Se conservaron los cambios y pruebas previos del formulario de rol/alcance.

Las nuevas pruebas SQL cubren los ocho roles, alcance nacional/regional/
municipal/establecimiento, territorios activos e inactivos, vigencias,
revocación inmediata, usuario suspendido, identidad incorrecta, valores
maliciosos, deduplicación, campos del contrato, selección temporal y filtros
regionales. Verifican una consulta por operación y ninguna para alcance vacío.

PostgreSQL utilizó un contenedor exclusivo `sigvits-qa-access-20260902`, puerto
loopback 55433, base `sigvits_qa_access`, 23 migraciones y datos sintéticos con
limpieza por identificadores propios. La suite exige `QA_DATABASE_URL` local
con prefijo `sigvits_qa`; nunca usa implícitamente la URL institucional.
Al terminar se detuvo el contenedor de QA, sin eliminarlo ni detener otros servicios.
El workflow existente `postgres-concurrency.yml` descubre estas pruebas
automáticamente. Las advertencias existentes de módulos VM experimentales
y de concurrencia interna del adaptador `pg` no impidieron la ejecución.

Comandos de comprobación, desde cada carpeta:

```powershell
# backend
npm run check
# Solo con QA_DATABASE_URL apuntando a una base local aislada y migrada:
npm run test:postgres:qa

# frontend
npm run check
npx tsc --noEmit -p tsconfig.spec.json
```

## Aplicación y límites

Reiniciar NestJS si se ejecuta sin watch; con `npm run start:dev` recompila al
detectar cambios. Recargar Angular y volver a iniciar sesión para comprobar
la percepción real. No se requieren migraciones en Supabase para este cambio.

No se midió un recorrido de login autenticado en navegador en esta iteración.
Quedan fuera de esta evidencia una certificación de miles de usuarios,
percentiles bajo carga, latencia del despliegue definitivo y crecimiento del
listado administrativo, que aún no tiene paginación de servidor. Esos puntos
requieren pruebas y, para paginación, ajustar conjuntamente API e interfaz.
