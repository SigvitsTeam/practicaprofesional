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

map_tile_url="${SIGVITS_MAP_TILE_URL:-https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png}"
map_attribution="${SIGVITS_MAP_ATTRIBUTION:-© OpenStreetMap contributors}"
map_max_zoom="${SIGVITS_MAP_MAX_ZOOM:-18}"
map_small_count_threshold="${SIGVITS_MAP_SMALL_COUNT_THRESHOLD:-5}"
case "$map_tile_url" in
  https://*) ;;
  *) echo "SIGVITS_MAP_TILE_URL debe ser una URL HTTPS." >&2; exit 65 ;;
esac
case "$map_max_zoom" in
  ''|*[!0-9]*) echo "SIGVITS_MAP_MAX_ZOOM debe ser un entero entre 1 y 22." >&2; exit 65 ;;
esac
if [ "$map_max_zoom" -lt 1 ] || [ "$map_max_zoom" -gt 22 ]; then
  echo "SIGVITS_MAP_MAX_ZOOM debe estar entre 1 y 22." >&2
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
