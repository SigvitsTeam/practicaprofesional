import http from 'k6/http';
import { check, sleep } from 'k6';

const targetVus = Number(__ENV.TARGET_VUS || 1000);
const baseUrl = (__ENV.BASE_URL || '').replace(/\/$/, '');
const accessToken = __ENV.ACCESS_TOKEN || '';
const year = Number(__ENV.PERIOD_YEAR || new Date().getUTCFullYear());
const month = Number(__ENV.PERIOD_MONTH || new Date().getUTCMonth() + 1);

export const options = {
  scenarios: {
    institutional_reads: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: __ENV.RAMP_UP || '2m', target: Math.max(1, Math.ceil(targetVus / 4)) },
        { duration: __ENV.RAMP_PEAK || '3m', target: targetVus },
        { duration: __ENV.HOLD || '10m', target: targetVus },
        { duration: __ENV.RAMP_DOWN || '2m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    'http_req_duration{endpoint:profile}': ['p(95)<500'],
    'http_req_duration{endpoint:analytics}': ['p(95)<500'],
    'http_req_duration{endpoint:exports}': ['p(95)<500'],
  },
};

export function setup() {
  if (!baseUrl || !accessToken)
    throw new Error('BASE_URL y ACCESS_TOKEN son obligatorios para ejecutar la prueba de carga.');
  const health = http.get(`${baseUrl}/api/health/ready`);
  if (health.status !== 200) throw new Error(`El staging no está saludable: HTTP ${health.status}.`);
}

export default function () {
  const headers = { authorization: `Bearer ${accessToken}`, accept: 'application/json' };
  const responses = http.batch([
    ['GET', `${baseUrl}/api/v1/auth/me`, null, { headers, tags: { endpoint: 'profile' } }],
    ['GET', `${baseUrl}/api/v1/analytics/territorial?level=MUNICIPIO&year=${year}&month=${month}`, null, { headers, tags: { endpoint: 'analytics' } }],
    ['GET', `${baseUrl}/api/v1/exports/jobs`, null, { headers, tags: { endpoint: 'exports' } }],
  ]);
  check(responses, {
    'perfil autorizado': (rows) => rows[0].status === 200,
    'analítica autorizada': (rows) => rows[1].status === 200,
    'exportaciones autorizadas': (rows) => rows[2].status === 200,
  });
  sleep(1 + Math.random() * 2);
}
