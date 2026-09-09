#!/bin/sh
set -eu

required() {
  variable_name="$1"
  eval "value=\${${variable_name}:-}"
  if [ -z "$value" ]; then
    echo "La variable publica ${variable_name} es obligatoria." >&2
    exit 64
  fi
}

required SIGVITS_API_URL
required SIGVITS_API_ORIGIN
required SUPABASE_URL
required SUPABASE_PUBLISHABLE_KEY

case "$SIGVITS_API_URL" in
  http://*|https://*) ;;
  *) echo "SIGVITS_API_URL debe ser una URL HTTP(S)." >&2; exit 65 ;;
esac
case "$SUPABASE_URL" in
  http://*|https://*) ;;
  *) echo "SUPABASE_URL debe ser una URL HTTP(S)." >&2; exit 65 ;;
esac

default_map_tile_url='https://tile.openstreetmap.org/{z}/{x}/{y}.png'
map_tile_url="${SIGVITS_MAP_TILE_URL:-}"
if [ -z "$map_tile_url" ]; then
  map_tile_url="$default_map_tile_url"
fi
map_attribution="${SIGVITS_MAP_ATTRIBUTION:-}"
if [ "$map_tile_url" != "$default_map_tile_url" ] && [ -z "$map_attribution" ]; then
  echo "SIGVITS_MAP_ATTRIBUTION es obligatoria cuando SIGVITS_MAP_TILE_URL usa otro proveedor." >&2
  exit 65
fi
if [ -z "$map_attribution" ]; then
  map_attribution='© OpenStreetMap contributors'
fi
map_max_zoom="${SIGVITS_MAP_MAX_ZOOM:-18}"
map_small_count_threshold="${SIGVITS_MAP_SMALL_COUNT_THRESHOLD:-5}"
case "$map_tile_url" in
  https://*) ;;
  *) echo "SIGVITS_MAP_TILE_URL debe ser una URL HTTPS." >&2; exit 65 ;;
esac
map_tile_authority="${map_tile_url#https://}"
map_tile_authority="${map_tile_authority%%/*}"
case "$map_tile_authority" in
  ''|*@*) echo "SIGVITS_MAP_TILE_URL debe ser una URL HTTPS válida sin credenciales." >&2; exit 65 ;;
esac
case "$map_tile_url" in
  *[[:space:]]*|*\\*) echo "SIGVITS_MAP_TILE_URL debe ser una URL HTTPS válida sin credenciales." >&2; exit 65 ;;
esac
for tile_token in '{z}' '{x}' '{y}'; do
  case "$map_tile_url" in
    *"$tile_token"*) ;;
    *) echo "SIGVITS_MAP_TILE_URL debe incluir {z}, {x} y {y}." >&2; exit 65 ;;
  esac
done
case "$map_max_zoom" in
  ''|*[!0-9]*) echo "SIGVITS_MAP_MAX_ZOOM debe ser un entero entre 5 y 22." >&2; exit 65 ;;
esac
if [ "$map_max_zoom" -lt 5 ] || [ "$map_max_zoom" -gt 22 ]; then
  echo "SIGVITS_MAP_MAX_ZOOM debe estar entre 5 y 22." >&2
  exit 65
fi
case "$map_small_count_threshold" in
  ''|*[!0-9]*) echo "SIGVITS_MAP_SMALL_COUNT_THRESHOLD debe ser un entero entre 0 y 100." >&2; exit 65 ;;
esac
if [ "$map_small_count_threshold" -lt 0 ] || [ "$map_small_count_threshold" -gt 100 ]; then
  echo "SIGVITS_MAP_SMALL_COUNT_THRESHOLD debe estar entre 0 y 100." >&2
  exit 65
fi

umask 027
target=/usr/share/nginx/html/config/runtime-config.json
temporary="${target}.tmp"
jq -n \
  --arg apiUrl "$SIGVITS_API_URL" \
  --arg supabaseUrl "${SUPABASE_URL%/}" \
  --arg supabaseAnonKey "$SUPABASE_PUBLISHABLE_KEY" \
  --arg mapTileUrl "$map_tile_url" \
  --arg mapAttribution "$map_attribution" \
  --argjson mapMaxZoom "$map_max_zoom" \
  --argjson mapSmallCountThreshold "$map_small_count_threshold" \
  '{
    apiUrl: $apiUrl,
    auth: {
      supabaseUrl: $supabaseUrl,
      supabaseAnonKey: $supabaseAnonKey,
      demoEnabled: false,
      demoEmail: "",
      demoPassword: ""
    },
    maps: {
      tileUrl: $mapTileUrl,
      attribution: $mapAttribution,
      maxZoom: $mapMaxZoom,
      smallCountThreshold: $mapSmallCountThreshold
    }
  }' \
  > "$temporary"
mv "$temporary" "$target"
