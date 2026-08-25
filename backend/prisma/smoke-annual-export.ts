import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';

config();
config({ path: '.env.pilot-users', override: true });

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`La variable ${name} es obligatoria.`);
  return value;
}

interface ExportJob {
  id: string;
  reportType: string;
  status: 'PENDIENTE' | 'PROCESANDO' | 'COMPLETADO' | 'FALLIDO';
  outputAvailable: boolean;
  errorCode?: string;
}

const issuer = required('AUTH_ISSUER').replace(/\/$/, '');
const supabaseUrl = issuer.replace(/\/auth\/v1$/, '');
const publishableKey = required('SUPABASE_PUBLISHABLE_KEY');
const apiBase = `http://127.0.0.1:${process.env.PORT?.trim() || '3000'}/${process.env.API_PREFIX?.trim() || 'api'}/v1`;

async function signIn(): Promise<string> {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: publishableKey },
    body: JSON.stringify({
      email: required('PILOT_COORDINATOR_EMAIL'),
      password: required('PILOT_COORDINATOR_PASSWORD'),
    }),
  });
  const body = (await response.json()) as { access_token?: string; message?: string };
  if (!response.ok || !body.access_token)
    throw new Error(
      `Supabase Auth rechazó el smoke de exportación: ${body.message || response.status}.`,
    );
  return body.access_token;
}

async function api<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const text = await response.text();
  const body = text ? (JSON.parse(text) as T & { detail?: string; message?: string }) : undefined;
  if (!response.ok)
    throw new Error(body?.detail || body?.message || `API ${path} respondió ${response.status}.`);
  return body as T;
}

async function waitForCompletion(token: string, jobId: string): Promise<ExportJob> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const jobs = await api<ExportJob[]>(token, '/exports/jobs');
    const job = jobs.find((item) => item.id === jobId);
    if (job?.status === 'COMPLETADO') return job;
    if (job?.status === 'FALLIDO')
      throw new Error(`La exportación anual falló: ${job.errorCode || 'sin código'}.`);
    await new Promise<void>((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('La exportación anual no terminó dentro de 30 segundos.');
}

async function run(): Promise<void> {
  const token = await signIn();
  const job = await api<ExportJob>(token, '/exports/jobs', {
    method: 'POST',
    body: JSON.stringify({
      idempotencyKey: randomUUID(),
      reportType: 'ANNUAL_COMPARISON',
      format: 'XLSX',
      scopeLevel: 'MUNICIPIO',
      year: 2026,
      month: 8,
      parameters: {
        dimension: 'periods',
        rangeAStart: '2025-07',
        rangeAEnd: '2025-08',
        rangeBStart: '2026-07',
        rangeBEnd: '2026-08',
        indicatorA: 'TOTAL_CASES',
        indicatorB: 'RATE_PER_1000',
      },
    }),
  });
  const completed = await waitForCompletion(token, job.id);
  const download = await fetch(`${apiBase}/exports/jobs/${job.id}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const contents = new Uint8Array(await download.arrayBuffer());
  if (!download.ok || contents[0] !== 0x50 || contents[1] !== 0x4b)
    throw new Error(
      `El artefacto XLSX anual no es válido (${download.status}, ${download.headers.get('content-type') || 'sin tipo'}, bytes iniciales ${[...contents.slice(0, 8)].join(',')}).`,
    );
  process.stdout.write(
    `${JSON.stringify({ auth: 'ok', queued: 'ok', worker: 'ok', download: 'ok', jobId: completed.id, bytes: contents.length })}\n`,
  );
}

run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
