import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';

config();
config({ path: '.env.pilot-users', override: true });

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`La variable ${name} es obligatoria.`);
  return value;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function hondurasToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Tegucigalpa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

interface Disease {
  id: string;
  name: string;
  appliesToMale: boolean;
  appliesToFemale: boolean;
}

interface CaptureContext {
  facilities: { id: string; code: string; name: string }[];
  populationTypes: { id: string; code: string; name: string }[];
  classifications: { diseases: Disease[] }[];
}

interface CreatedAttention {
  id: string;
  updatedAt: string;
}

interface ProblemDetails {
  status?: number;
  detail?: string;
  errors?: string[];
}

const issuer = required('AUTH_ISSUER').replace(/\/$/, '');
const supabaseUrl = issuer.replace(/\/auth\/v1$/, '');
const publishableKey = required('SUPABASE_PUBLISHABLE_KEY');
const configuredApiBase =
  process.env.SIGVITS_API_BASE_URL?.trim() ??
  `http://127.0.0.1:${process.env.PORT?.trim() || '3000'}/${process.env.API_PREFIX?.trim() || 'api'}/v1`;
const apiBase = configuredApiBase.replace(/\/$/, '');

function assertSafeTarget(): void {
  const target = new URL(apiBase);
  const local = ['127.0.0.1', 'localhost', '::1'].includes(target.hostname);
  if (!local && process.env.ALLOW_REMOTE_SMOKE !== 'true')
    throw new Error(
      'La prueba modifica datos. Para un API remoto se requiere ALLOW_REMOTE_SMOKE=true de forma explícita.',
    );
}

async function signIn(): Promise<string> {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: publishableKey },
    body: JSON.stringify({
      email:
        process.env.PILOT_COORDINATION_DATA_ENTRY_EMAIL?.trim() ||
        required('PILOT_FACILITY_MANAGER_EMAIL'),
      password:
        process.env.PILOT_COORDINATION_DATA_ENTRY_PASSWORD?.trim() ||
        required('PILOT_FACILITY_MANAGER_PASSWORD'),
    }),
  });
  const body = (await response.json()) as {
    access_token?: string;
    message?: string;
    error_description?: string;
  };
  if (!response.ok || !body.access_token)
    throw new Error(
      `Supabase Auth rechazó el usuario de prueba: ${body.message || body.error_description || response.status}.`,
    );
  return body.access_token;
}

async function apiRaw(token: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
}

async function api<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await apiRaw(token, path, init);
  const text = await response.text();
  const body = text ? (JSON.parse(text) as T & ProblemDetails) : undefined;
  if (!response.ok)
    throw new Error(
      body?.detail || body?.errors?.join(', ') || `API respondió ${response.status}.`,
    );
  return body as T;
}

async function createIfEditable(
  token: string,
  payload: Record<string, unknown>,
): Promise<CreatedAttention | undefined> {
  const response = await apiRaw(token, '/its1/attentions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const body = (await response.json()) as CreatedAttention & ProblemDetails;
  if (response.ok) return body;
  if (
    response.status === 409 &&
    (body.detail?.includes('reporte enviado o aprobado') ||
      body.detail?.includes('no admite nuevas atenciones'))
  )
    return undefined;
  throw new Error(body.detail || body.errors?.join(', ') || `API respondió ${response.status}.`);
}

function attentionPayload(
  facilityId: string,
  populationTypeId: string,
  attentionDate: string,
  sex: 'H' | 'M',
  diseaseId: string,
): Record<string, unknown> {
  return {
    facilityId,
    attentionDate,
    patientRecordNumber: `SMOKE-${randomUUID()}`,
    originText: 'Dato sintético de certificación automatizada',
    sex,
    age: 30,
    populationTypeId,
    isContact: false,
    isPregnant: false,
    observation: 'Registro sintético; debe quedar anulado al finalizar la prueba.',
    diagnoses: [{ diseaseId, caseType: 'NUEVO' }],
  };
}

async function expectRejected(
  token: string,
  payload: Record<string, unknown>,
  expectedSex: string,
): Promise<void> {
  const response = await apiRaw(token, '/its1/attentions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const body = (await response.json()) as ProblemDetails;
  if (response.status !== 400 || !body.detail?.includes(expectedSex))
    throw new Error(
      `La combinación incompatible para ${expectedSex} no fue rechazada con el contrato esperado (HTTP ${response.status}).`,
    );
}

async function run(): Promise<void> {
  assertSafeTarget();
  const attentionDate = process.env.SMOKE_ATTENTION_DATE?.trim() || hondurasToday();
  if (!/^20\d{2}-(0[1-9]|1[0-2])-([012]\d|3[01])$/.test(attentionDate))
    throw new Error(
      'SMOKE_ATTENTION_DATE debe usar el formato YYYY-MM-DD y pertenecer a un período abierto.',
    );
  const token = await signIn();
  const context = await api<CaptureContext>(token, '/its1/attentions/context');
  const facilityCode = process.env.SMOKE_FACILITY_CODE?.trim() || '85481';
  const preferredFacility = context.facilities.find((item) => item.code === facilityCode);
  const facilities = preferredFacility
    ? [preferredFacility, ...context.facilities.filter((item) => item.id !== preferredFacility.id)]
    : context.facilities;
  const population =
    context.populationTypes.find((item) => normalize(item.code) === 'general') ??
    context.populationTypes[0];
  const diseases = context.classifications.flatMap((item) => item.diseases);
  const urethralDischarge = diseases.find((item) => normalize(item.name) === 'flujo uretral');
  const cervicitis = diseases.find((item) => normalize(item.name) === 'cervicitis');
  if (!facilities.length || !population || !urethralDischarge || !cervicitis)
    throw new Error(
      'El contexto piloto no contiene establecimiento, población o patologías requeridas.',
    );
  if (
    !urethralDischarge.appliesToMale ||
    urethralDischarge.appliesToFemale ||
    cervicitis.appliesToMale ||
    !cervicitis.appliesToFemale
  )
    throw new Error(
      'El catálogo no refleja la aplicabilidad por sexo aprobada para Flujo uretral y Cervicitis.',
    );

  const femaleUrethral = attentionPayload(
    facilities[0]!.id,
    population.id,
    attentionDate,
    'M',
    urethralDischarge.id,
  );
  const maleCervicitis = attentionPayload(
    facilities[0]!.id,
    population.id,
    attentionDate,
    'H',
    cervicitis.id,
  );
  await expectRejected(token, femaleUrethral, 'Mujer');
  await expectRejected(token, maleCervicitis, 'Hombre');

  const created: CreatedAttention[] = [];
  let selectedFacilityId: string | undefined;
  let cleanupError: unknown;
  try {
    for (const candidate of facilities) {
      const female = await createIfEditable(token, {
        ...femaleUrethral,
        facilityId: candidate.id,
        diagnoses: [{ diseaseId: cervicitis.id, caseType: 'NUEVO' }],
      });
      if (!female) continue;
      selectedFacilityId = candidate.id;
      created.push(female);
      created.push(
        await api<CreatedAttention>(token, '/its1/attentions', {
          method: 'POST',
          body: JSON.stringify({
            ...maleCervicitis,
            facilityId: candidate.id,
            diagnoses: [{ diseaseId: urethralDischarge.id, caseType: 'NUEVO' }],
          }),
        }),
      );
      break;
    }
  } finally {
    for (const attention of created) {
      try {
        await api(token, `/its1/attentions/${attention.id}/cancel`, {
          method: 'PATCH',
          body: JSON.stringify({
            facilityId: selectedFacilityId,
            expectedUpdatedAt: attention.updatedAt,
            reason: 'Anulación automática posterior a certificación de reglas por sexo.',
          }),
        });
      } catch (error: unknown) {
        cleanupError = error;
      }
    }
  }
  if (cleanupError)
    throw new Error(
      `La prueba funcional terminó, pero no pudo anular todos los registros sintéticos: ${cleanupError instanceof Error ? cleanupError.message : 'error desconocido'}`,
    );
  if (created.length !== 2)
    throw new Error(
      'No existe un establecimiento autorizado con período editable para probar las combinaciones válidas.',
    );
  process.stdout.write(
    `${JSON.stringify({ authentication: 'ok', femaleUrethralDischargeRejected: true, maleCervicitisRejected: true, validCombinationsCreated: 2, syntheticRecordsCancelled: 2 })}\n`,
  );
}

run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Error desconocido'}\n`);
  process.exitCode = 1;
});
