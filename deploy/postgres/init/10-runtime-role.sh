#!/bin/sh
set -eu

password_file=/run/secrets/runtime_db_password
if [ ! -r "$password_file" ]; then
  echo "No se puede leer el secreto runtime_db_password." >&2
  exit 66
fi

runtime_password="$(tr -d '\r\n' < "$password_file")"
if [ "${#runtime_password}" -lt 24 ]; then
  echo "runtime_db_password debe contener al menos 24 caracteres." >&2
  exit 65
fi

# El backend necesita BYPASSRLS porque las tablas fuerzan RLS y, por diseño,
# no existen políticas públicas: la autorización ocurre exclusivamente en API.
# A diferencia del propietario de migraciones, este rol no puede crear ni
# alterar objetos, roles o bases de datos.
docker_process_sql \
  --set=runtime_password="$runtime_password" \
  --set=owner_role="$POSTGRES_USER" <<'SQL'
SELECT format(
  'CREATE ROLE sigvits_runtime LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION BYPASSRLS',
  :'runtime_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sigvits_runtime')
\gexec

ALTER ROLE sigvits_runtime PASSWORD :'runtime_password';
REVOKE ALL ON SCHEMA public FROM sigvits_runtime;
GRANT USAGE ON SCHEMA public TO sigvits_runtime;

SELECT format('REVOKE ALL ON DATABASE %I FROM sigvits_runtime', current_database())
\gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO sigvits_runtime', current_database())
\gexec

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sigvits_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sigvits_runtime;

SELECT format(
  'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sigvits_runtime',
  :'owner_role'
)
\gexec
SELECT format(
  'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO sigvits_runtime',
  :'owner_role'
)
\gexec
SQL
