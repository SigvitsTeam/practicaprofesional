import { config } from 'dotenv';

config();
config({ path: '.env.pilot-users', override: true });

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`La variable ${name} es obligatoria.`);
  return value;
}

type WorkflowStatus =
  'BORRADOR' | 'ENVIADO_A_MUNICIPIO' | 'DEVUELTO_POR_MUNICIPIO' | 'APROBADO_MUNICIPIO';

interface WorkflowReport {
  id: string;
  status: WorkflowStatus;
  version: number;
  facility: { id: string; code: string; name: string };
}

interface CaptureContext {
  facilities: { id: string; code: string; name: string }[];
}

const issuer = required('AUTH_ISSUER').replace(/\/$/, '');
const supabaseUrl = issuer.replace(/\/auth\/v1$/, '');
const publishableKey = required('SUPABASE_PUBLISHABLE_KEY');
const apiBase = `http://127.0.0.1:${process.env.PORT?.trim() || '3000'}/${process.env.API_PREFIX?.trim() || 'api'}/v1`;

async function signIn(emailName: string, passwordName: string): Promise<string> {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: publishableKey },
    body: JSON.stringify({ email: required(emailName), password: required(passwordName) }),
  });
  const body = (await response.json()) as {
    access_token?: string;
    message?: string;
    msg?: string;
    error_description?: string;
    error_code?: string;
  };
  if (!response.ok || !body.access_token)
    throw new Error(
      `Supabase Auth rechazó ${emailName}: ${body.message || body.msg || body.error_description || body.error_code || response.status}.`,
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
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  const body = text ? (JSON.parse(text) as T & { detail?: string; message?: string }) : undefined;
  if (!response.ok)
    throw new Error(body?.detail || body?.message || `API ${path} respondió ${response.status}.`);
  return body as T;
}

async function run(): Promise<void> {
  const [coordinatorToken, dataEntryToken, facilityManagerToken] = await Promise.all([
    signIn('PILOT_COORDINATOR_EMAIL', 'PILOT_COORDINATOR_PASSWORD'),
    signIn('PILOT_DATA_ENTRY_EMAIL', 'PILOT_DATA_ENTRY_PASSWORD'),
    signIn('PILOT_FACILITY_MANAGER_EMAIL', 'PILOT_FACILITY_MANAGER_PASSWORD'),
  ]);
  const [dataEntryContext, facilityContext] = await Promise.all([
    api<CaptureContext>(dataEntryToken, '/its1/attentions/context'),
    api<CaptureContext>(facilityManagerToken, '/its1/attentions/context'),
  ]);
  const facility = facilityContext.facilities.find((item) => item.code === '85481');
  if (!facility) throw new Error('El responsable no tiene asignado CIS Linda Coello (85481).');
  if (!dataEntryContext.facilities.some((item) => item.code === facility.code))
    throw new Error('El digitador municipal no heredó los establecimientos de Puerto Cortés.');

  const period = { year: 2026, month: 8 };
  let current = await api<WorkflowReport | null>(
    facilityManagerToken,
    `/its2/reports/current?facilityId=${facility.id}&year=${period.year}&month=${period.month}`,
  );
  if (current?.status === 'APROBADO_MUNICIPIO') {
    process.stdout.write(
      `${JSON.stringify({ auth: 'ok', territory: 'ok', reportId: current.id, version: current.version, status: current.status, reused: true })}\n`,
    );
    return;
  }
  if (!current || current.status === 'BORRADOR' || current.status === 'DEVUELTO_POR_MUNICIPIO') {
    current = await api<WorkflowReport>(facilityManagerToken, '/its2/reports/prepare', {
      method: 'POST',
      body: JSON.stringify({
        facilityId: facility.id,
        ...period,
        attentionsUnder15: 0,
        attentions15Plus: 0,
        attentionTotalsSource: 'Prueba piloto autenticada SIGVITS',
      }),
    });
    current = await api<WorkflowReport>(
      facilityManagerToken,
      `/its2/reports/${current.id}/submit`,
      {
        method: 'POST',
        body: '{}',
      },
    );
  }
  if (current.status !== 'ENVIADO_A_MUNICIPIO')
    throw new Error(`El reporte no quedó listo para revisión municipal: ${current.status}.`);

  const inbox = await api<WorkflowReport[]>(
    coordinatorToken,
    `/its2/reports/municipal-inbox?year=${period.year}&month=${period.month}`,
  );
  if (!inbox.some((item) => item.id === current.id))
    throw new Error('El reporte enviado no apareció en la bandeja municipal.');
  await api<WorkflowReport>(coordinatorToken, `/its2/reports/${current.id}/return`, {
    method: 'POST',
    body: JSON.stringify({ comment: 'Corrección controlada durante la prueba autenticada.' }),
  });
  const corrected = await api<WorkflowReport>(facilityManagerToken, '/its2/reports/prepare', {
    method: 'POST',
    body: JSON.stringify({
      facilityId: facility.id,
      ...period,
      attentionsUnder15: 0,
      attentions15Plus: 0,
      attentionTotalsSource: 'Prueba piloto autenticada SIGVITS corregida',
      comment: 'Corrección aplicada y versión regenerada.',
    }),
  });
  const resubmitted = await api<WorkflowReport>(
    facilityManagerToken,
    `/its2/reports/${corrected.id}/submit`,
    { method: 'POST', body: '{}' },
  );
  const approved = await api<WorkflowReport>(
    coordinatorToken,
    `/its2/reports/${resubmitted.id}/approve`,
    { method: 'POST', body: JSON.stringify({ comment: 'Prueba autenticada aprobada.' }) },
  );
  process.stdout.write(
    `${JSON.stringify({ auth: 'ok', territory: 'ok', municipalInbox: 'ok', correctionVersioning: corrected.version > current.version, reportId: approved.id, version: approved.version, status: approved.status })}\n`,
  );
}

run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Error desconocido'}\n`);
  process.exitCode = 1;
});
