#!/bin/sh
set -eu

load_secret() {
  variable_name="$1"
  eval "file_path=\${${variable_name}_FILE:-}"
  eval "direct_value=\${${variable_name}:-}"

  if [ -n "$file_path" ] && [ -n "$direct_value" ]; then
    echo "No configure simultaneamente ${variable_name} y ${variable_name}_FILE." >&2
    exit 64
  fi

  if [ -n "$file_path" ]; then
    if [ ! -r "$file_path" ]; then
      echo "No se puede leer el secreto ${variable_name}." >&2
      exit 66
    fi
    secret_value="$(tr -d '\r\n' < "$file_path")"
    if [ -z "$secret_value" ]; then
      echo "El secreto ${variable_name} esta vacio." >&2
      exit 65
    fi
    export "${variable_name}=${secret_value}"
  fi
}

load_secret DATABASE_URL
load_secret DIRECT_URL
load_secret AUTH_ADMIN_SECRET
load_secret METRICS_BEARER_TOKEN

validate_database_tls() {
  variable_name="$1"
  node - "$variable_name" <<'NODE'
const name = process.argv[2];
const value = process.env[name];
if (!value) process.exit(0);

let url;
try {
  url = new URL(value);
} catch {
  process.stderr.write(`El secreto ${name} no contiene una URL PostgreSQL valida.\n`);
  process.exit(65);
}

const internalHosts = new Set(['postgres', 'localhost', '127.0.0.1', '[::1]', '::1']);
if (internalHosts.has(url.hostname.toLowerCase())) process.exit(0);

const sslMode = url.searchParams.get('sslmode')?.toLowerCase();
if (!['require', 'verify-ca', 'verify-full'].includes(sslMode ?? '')) {
  process.stderr.write(
    `${name} apunta a PostgreSQL remoto y debe declarar sslmode=require, verify-ca o verify-full.\n`,
  );
  process.exit(65);
}
NODE
}

validate_database_tls DATABASE_URL
validate_database_tls DIRECT_URL

if [ -n "${EXPORT_STORAGE_DIRECTORY:-}" ] && [ ! -w "$EXPORT_STORAGE_DIRECTORY" ]; then
  echo "El volumen de exportaciones no permite escritura al usuario de servicio. Revise propietario y permisos antes de arrancar." >&2
  exit 73
fi

exec "$@"
