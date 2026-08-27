# Seguridad de secretos y cadena de suministro

## Controles automatizados

El workflow `.github/workflows/ci.yml` instala exclusivamente desde lockfiles con `npm ci`, valida
formato, lint obligatorio en ambos proyectos, pruebas, builds, Prisma, una integración real con
PostgreSQL/PostGIS, migraciones, readiness, dependencias de producción y contenedores. Las acciones de
GitHub están fijadas por SHA y `persist-credentials` está desactivado. Se genera un SBOM CycloneDX por
aplicación y Dependabot propone actualizaciones acotadas.

`node tools/security/verify-repository.mjs` rechaza archivos de entorno, llaves privadas, tokens
administrativos y credenciales PostgreSQL reales versionados. Es una barrera complementaria: el
repositorio debe habilitar secret scanning, push protection, protección de `main`, revisión obligatoria
y aprobación del environment de producción en GitHub.

## Gestión de secretos

En Docker Compose, cree fuera de Git los archivos siguientes con permisos exclusivos del operador:

- `deploy/secrets/postgres_password.txt`;
- `deploy/secrets/runtime_db_password.txt` para el rol restringido de aplicación;
- `deploy/secrets/database_url.txt` para el pool de runtime como `sigvits_runtime`;
- `deploy/secrets/direct_url.txt` para migraciones, backup y tareas administrativas;
- `deploy/secrets/auth_admin_secret.txt` para la clave administrativa del proveedor de identidad;
- `deploy/secrets/metrics_bearer_token.txt` para proteger métricas de API y worker.

El entrypoint carga los secretos sin mostrarlos y rechaza URL PostgreSQL remotas si no usan
`sslmode=require`, `verify-ca` o `verify-full`. El rol runtime conserva sólo conexión, uso de schema,
DML y secuencias. `BYPASSRLS` es una excepción explícita porque no hay políticas públicas y NestJS es
la única capa autorizada; el rol no recibe DDL, propiedad, superusuario ni administración de roles.

En infraestructura administrada, reemplace archivos locales por el gestor de secretos de la
plataforma. No use `ARG` ni `ENV` durante el build para credenciales. El frontend recibe únicamente la
URL pública y la clave publicable de Supabase.

## Dependencias e imágenes

- Toda actualización conserva y revisa `package-lock.json`; no se aceptan rangos modificados sin el
  lockfile correspondiente.
- `npm audit --omit=dev --audit-level=high` bloquea vulnerabilidades altas o críticas de runtime. Las
  excepciones requieren riesgo, compensación, responsable y fecha de vencimiento documentados.
- Las imágenes declaran versiones concretas, usuario sin privilegios, raíz de sólo lectura,
  capabilities eliminadas y `no-new-privileges`. Antes de la salida institucional, el registry debe
  promover por digest la misma imagen certificada en staging; no se reconstruye para producción.
- CI escanea las imágenes de runtime con Trivy y bloquea vulnerabilidades altas/críticas corregibles;
  además archiva los identificadores `sha256` resueltos localmente. El SBOM, digest OCI del registry y
  resultado de escaneo se anexan a la evidencia de release. El registry debe
  impedir sobrescritura de tags y aplicar firma/verificación de procedencia cuando esté disponible.

## Política de actualización

Parches de seguridad críticos se evalúan en 24 horas; altos en siete días. Una actualización ejecuta
todo CI, smoke autenticado y regresión de autorización. Las actualizaciones mayores se separan de
cambios funcionales para conservar un rollback claro.
