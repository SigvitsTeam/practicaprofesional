# Backend SIGVITS

Base del backend institucional construida como monolito modular con NestJS. NestJS es la
autoridad de reglas de negocio; PostgreSQL será la persistencia portable y Supabase solamente
el proveedor inicial.

## Requisitos

- Node.js 22 o superior.
- npm 11 o superior.

## Ejecución local

```bash
copy .env.example .env
npm install
npm run db:generate
npm run start:dev
```

- Salud: `GET http://localhost:3000/api/health`
- Disponibilidad de dependencias: `GET http://localhost:3000/api/health/ready`
`CORS_ORIGINS` debe contener una lista explícita separada por comas; no se admite el comodín
como configuración recomendada.

## Verificación

```bash
npm run check
```

El comando valida formato, reglas estáticas, pruebas unitarias, pruebas HTTP y compilación.

## Base de datos

Prisma 7 usa el adaptador oficial `pg`, pero permanece detrás de repositorios del dominio. La
migración inicial crea PostgreSQL + PostGIS, regiones, redes, municipios, establecimientos,
vigencias y auditoría. También incorpora restricciones que Prisma no expresa por sí solo:

- Red y municipio deben pertenecer a la misma región.
- Solo puede existir una asociación vigente por municipio y programa.
- Las fechas de fin no pueden preceder a las fechas de inicio.
- Latitud y longitud deben ser válidas y aparecer juntas.
- La geometría PostGIS del establecimiento se deriva en base de datos.
- Todas las tablas operativas tienen RLS forzado y no conceden acceso directo a `anon` ni
  `authenticated`; NestJS es la autoridad de negocio.

Comandos:

```bash
npm run db:validate
npm run db:migrate:dev -- --name cambio_descriptivo
npm run db:migrate:deploy
npm run db:verify-deployment
```

`DATABASE_URL` es obligatorio en producción. En desarrollo puede omitirse para ejecutar pruebas y
health checks, pero cualquier operación persistente fallará de forma explícita hasta configurarla.
El comando de generación usa una URL local no operativa cuando no existe la variable; esta URL solo
permite compilar tipos y nunca sustituye la configuración necesaria para migrar o ejecutar consultas.
En Supabase, `DATABASE_URL` usa el pooler de transacciones para la API y `DIRECT_URL` usa el pooler
de sesión para migraciones. Prisma Config prioriza `DIRECT_URL` al ejecutar migraciones.

## Arquitectura

Cada dominio crecerá con la dirección de dependencias siguiente:

```text
HTTP/Controller -> Aplicación/Caso de uso -> Dominio <- Puertos
                                                   <- Adaptadores PostgreSQL, colas y storage
```

- Los controladores traducen HTTP; no contienen reglas institucionales.
- El dominio no importa Prisma, Supabase, Redis, ExcelJS ni detalles de transporte.
- Los adaptadores implementan puertos definidos hacia adentro.
- Las consultas individuales ITS 1 y las agregadas ITS 2 usan casos de uso y contratos distintos.
- La autorización evalúa permiso + territorio + nivel de dato. El rol por sí solo nunca autoriza.
- Los logs HTTP no incluyen query strings, cuerpos, números de expediente ni datos clínicos.

## Decisiones vigentes aplicadas

- `DIGITADOR_ESTABLECIMIENTO` está eliminado; se usa `DIGITADOR_COORDINACION`.
- La procedencia de ITS 1 es texto libre. AGI y sus campos derivados están fuera del alcance vigente.
- Las redes son agrupaciones configurables y no agregan una etapa al flujo de aprobación.
- Un SuperAdmin o SuperAdmin Regional no obtiene acceso implícito a ITS 1.

El documento `docs/modelo-base-datos-its.md` fue armonizado con las decisiones del 3 y 4 de agosto
de 2026 antes de iniciar las migraciones. Los lineamientos históricos conservan contexto, pero sus
secciones sustituidas no deben convertirse en reglas de negocio.

## Controles presentes desde el arranque

- Configuración validada y fallo temprano ante valores inválidos.
- CORS explícito, cabeceras Helmet y límite configurable de cuerpo.
- Rate limiting global; en despliegues tras proxy se debe configurar `TRUST_PROXY` conscientemente.
- DTOs con lista blanca y rechazo de propiedades desconocidas.
- Identificador de correlación por petición.
- Errores RFC 7807 sin filtrar stack traces al cliente.
- Política de autorización con denegación por defecto y pruebas de privacidad.
- Verificación JWT asimétrica por JWKS, emisor, audiencia, expiración y algoritmo permitido.
- Identidad externa separada del usuario institucional; el JWT no concede roles ni territorios.

## Autenticación y autorización

La captura individual comienza en `POST /api/v1/its1/attentions`. Requiere el permiso
`its1:attentions:create`; el backend valida el establecimiento asignado, resuelve región,
municipio, semana epidemiológica, período mensual y grupos de edad, y registra auditoría
en la misma transacción.

La migración `202608130001_its_capture_core` incorpora los catálogos y tablas mínimas para
atenciones y diagnósticos. Debe aplicarse junto con los catálogos institucionales validados.

El backend acepta únicamente access tokens asimétricos `ES256` o `RS256`. Configure
`AUTH_ISSUER`, `AUTH_AUDIENCE` y `AUTH_JWKS_URL`; no se admite el secreto JWT legado dentro de la
aplicación. Los endpoints administrativos niegan por defecto cualquier ruta sin política explícita.

```text
JWT verificado -> identidad externa -> usuario activo -> roles vigentes
               -> permisos activos -> asignaciones territoriales vigentes -> caso de uso
```

Endpoints territoriales iniciales:

- `GET /api/v1/regions`: exige `territorial:regions:read` y filtra por alcance.
- `POST /api/v1/regions`: exige `territorial:regions:create`, alcance nacional y motivo de auditoría.

Después de aplicar las migraciones, vincule una única vez la primera identidad autenticada:

```bash
npm run db:bootstrap-admin
```

Requiere `BOOTSTRAP_ADMIN_ISSUER`, `BOOTSTRAP_ADMIN_SUBJECT`, `BOOTSTRAP_ADMIN_EMAIL` y
`BOOTSTRAP_ADMIN_NAME`. El proceso se niega a ejecutar si ya existe cualquier usuario, asigna el rol
`SUPERADMIN`, crea alcance nacional y registra el evento de auditoría. No crea ni almacena
contraseñas; el usuario debe existir previamente en el proveedor de identidad.

Autenticación real, persistencia, auditoría inmutable, Redis/BullMQ y almacenamiento se añadirán en
incrementos verticales. La existencia de esta base no debe interpretarse como preparación completa
para producción: antes de ello también se requieren gestión de secretos, TLS, backups restaurados,
MFA para perfiles privilegiados, observabilidad y pruebas de carga/seguridad.

La generación interactiva de OpenAPI se mantiene fuera del runtime inicial porque las versiones
disponibles de su cadena `js-yaml` presentan avisos de denegación de servicio. Se reintroducirá al
existir una combinación sin vulnerabilidades conocidas; los contratos de cada caso de uso seguirán
siendo obligatorios.
