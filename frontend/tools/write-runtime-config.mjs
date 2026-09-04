import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`La variable ${name} es obligatoria.`);
  return value;
}

function integer(name, fallback, minimum, maximum) {
  const raw = process.env[name]?.trim();
  const value = raw ? Number(raw) : fallback;
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`La variable ${name} debe ser un entero entre ${minimum} y ${maximum}.`);
  }
  return value;
}

const apiUrl =
  process.env.VERCEL === '1'
    ? required('SIGVITS_API_URL')
    : process.env.SIGVITS_API_URL?.trim() || 'http://localhost:3000/api';

if (process.env.VERCEL === '1') {
  const url = new URL(apiUrl);
  if (
    url.protocol !== 'https:' ||
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password
  ) {
    throw new Error('SIGVITS_API_URL debe ser una URL pública HTTPS sin credenciales.');
  }
}

const config = {
  apiUrl,
  auth: {
    supabaseUrl: required('SUPABASE_URL').replace(/\/$/, ''),
    supabaseAnonKey: required('SUPABASE_PUBLISHABLE_KEY'),
    demoEnabled: false,
    demoEmail: '',
    demoPassword: '',
  },
  maps: {
    tileUrl:
      process.env.SIGVITS_MAP_TILE_URL?.trim() ||
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: process.env.SIGVITS_MAP_ATTRIBUTION?.trim() || '© OpenStreetMap contributors',
    maxZoom: integer('SIGVITS_MAP_MAX_ZOOM', 18, 1, 22),
    smallCountThreshold: integer('SIGVITS_MAP_SMALL_COUNT_THRESHOLD', 5, 0, 100),
  },
};

const output = resolve('public', 'config', 'runtime-config.json');
await mkdir(resolve('public', 'config'), { recursive: true });
await writeFile(output, `${JSON.stringify(config, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
process.stdout.write(`${output}\n`);
