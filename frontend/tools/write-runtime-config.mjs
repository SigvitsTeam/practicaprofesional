import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`La variable ${name} es obligatoria.`);
  return value;
}

const config = {
  apiUrl: process.env.SIGVITS_API_URL?.trim() || 'http://localhost:3000/api',
  auth: {
    supabaseUrl: required('SUPABASE_URL').replace(/\/$/, ''),
    supabaseAnonKey: required('SUPABASE_PUBLISHABLE_KEY'),
    demoEnabled: false,
    demoEmail: '',
    demoPassword: '',
  },
};

const output = resolve('public', 'config', 'runtime-config.json');
await mkdir(resolve('public', 'config'), { recursive: true });
await writeFile(output, `${JSON.stringify(config, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
process.stdout.write(`${output}\n`);
