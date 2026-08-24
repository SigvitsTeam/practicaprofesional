import { VersioningType, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Application (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.DATABASE_URL;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports service health without exposing implementation details', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);

    expect(response.body).toEqual({ status: 'ok', timestamp: expect.any(String) });
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('returns a uniform problem response for unknown routes', async () => {
    const response = await request(app.getHttpServer()).get('/api/does-not-exist').expect(404);

    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.body).toMatchObject({
      status: 404,
      title: 'Recurso no encontrado',
      instance: '/api/does-not-exist',
      requestId: expect.any(String),
    });
  });

  it('separates liveness from database readiness', async () => {
    const response = await request(app.getHttpServer()).get('/api/health/ready').expect(503);

    expect(response.body).toMatchObject({
      status: 503,
      title: 'Servicio no disponible',
      detail: 'Las dependencias del servicio no están disponibles.',
      requestId: expect.any(String),
    });
  });

  it('denies territorial endpoints without credentials', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/regions').expect(401);

    expect(response.body).toMatchObject({
      status: 401,
      title: 'No autenticado',
      detail: 'Credenciales no válidas.',
    });
  });

  it('protects the current institutional profile', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('protects the territorial catalog before exposing configuration', async () => {
    await request(app.getHttpServer()).get('/api/v1/territories/catalog').expect(401);
  });

  it('protects territorial audit history before validating its query', async () => {
    await request(app.getHttpServer()).get('/api/v1/territories/audit-events').expect(401);
  });

  it('protects municipality creation before processing administrative data', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/territories/municipalities')
      .send({})
      .expect(401);
  });

  it('protects facility creation before processing administrative data', async () => {
    await request(app.getHttpServer()).post('/api/v1/territories/facilities').send({}).expect(401);
  });

  it('protects the health network catalog', async () => {
    await request(app.getHttpServer()).get('/api/v1/territories/networks').expect(401);
  });

  it('protects health network creation and membership changes', async () => {
    await request(app.getHttpServer()).post('/api/v1/territories/networks').send({}).expect(401);
    await request(app.getHttpServer())
      .put('/api/v1/territories/networks/11111111-1111-4111-8111-111111111111/municipalities')
      .send({})
      .expect(401);
    await request(app.getHttpServer())
      .patch('/api/v1/territories/networks/11111111-1111-4111-8111-111111111111/status')
      .send({})
      .expect(401);
  });

  it('protects territorial status transitions', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/territories/MUNICIPIO/11111111-1111-4111-8111-111111111111/status')
      .send({})
      .expect(401);
  });

  it('protects the institutional user catalog', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/users').expect(401);
  });

  it('protects atomic user provisioning before validating its payload', async () => {
    await request(app.getHttpServer()).post('/api/v1/admin/users').send({}).expect(401);
  });

  it('protects user suspension and reactivation', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/admin/users/11111111-1111-4111-8111-111111111111/status')
      .send({})
      .expect(401);
  });

  it('protects historical role and territory changes', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/users/11111111-1111-4111-8111-111111111111/access-changes')
      .send({})
      .expect(401);
  });

  it('protects external identity linking before validating its payload', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/users/11111111-1111-4111-8111-111111111111/external-identity')
      .send({})
      .expect(401);
  });

  it('protects institutional invitations before contacting the identity provider', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/users/11111111-1111-4111-8111-111111111111/invitation')
      .send({})
      .expect(401);
  });

  it('protects export job creation and history', async () => {
    await request(app.getHttpServer()).get('/api/v1/exports/jobs').expect(401);
    await request(app.getHttpServer()).post('/api/v1/exports/jobs').send({}).expect(401);
    await request(app.getHttpServer()).post('/api/v1/exports/jobs/its1').send({}).expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/exports/jobs/11111111-1111-4111-8111-111111111111/download')
      .expect(401);
  });

  it('rejects malformed bearer credentials without contacting identity services', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/regions')
      .set('Authorization', 'Basic invalid')
      .expect(401);
  });

  it('protects ITS 1 creation before processing individual patient data', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/its1/attentions')
      .send({
        facilityId: '11111111-1111-4111-8111-111111111111',
        patientRecordNumber: 'EXP-001',
      })
      .expect(401);
  });

  it('protects the ITS 1 capture context', async () => {
    await request(app.getHttpServer()).get('/api/v1/its1/attentions/context').expect(401);
  });

  it('protects paginated ITS 1 records before exposing individual data', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/its1/attentions')
      .query({
        facilityId: '11111111-1111-4111-8111-111111111111',
        year: 2026,
        month: 8,
      })
      .expect(401);
  });

  it('protects ITS 1 corrections before validating sensitive content', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/its1/attentions/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
      .send({
        facilityId: '11111111-1111-4111-8111-111111111111',
      })
      .expect(401);
  });

  it('protects ITS 1 cancellation before validating sensitive content', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/its1/attentions/11111111-1111-4111-8111-111111111111/cancel')
      .send({})
      .expect(401);
  });

  it('protects territorial analytics before exposing aggregated indicators', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/analytics/territorial?level=MUNICIPIO&year=2026&month=8')
      .expect(401);
  });

  it('protects the printable ITS 1 register', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/its1/attentions/register.pdf')
      .query({
        facilityId: '11111111-1111-4111-8111-111111111111',
        year: 2026,
        month: 8,
      })
      .expect(401);
  });

  it('protects the printable ITS 2 monthly report', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/its1/attentions/monthly-report.pdf')
      .query({
        facilityId: '11111111-1111-4111-8111-111111111111',
        year: 2026,
        month: 8,
      })
      .expect(401);
  });

  it('protects preparation of an ITS 2 workflow report', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/its2/reports/prepare')
      .send({ facilityId: '11111111-1111-4111-8111-111111111111', year: 2026, month: 8 })
      .expect(401);
  });

  it('protects the municipal ITS 2 review inbox', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/its2/reports/municipal-inbox')
      .query({ year: 2026, month: 8 })
      .expect(401);
  });

  it('protects preparation of a municipal consolidation', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/its2/municipal-consolidations/prepare')
      .send({
        municipalityId: '11111111-1111-4111-8111-111111111111',
        year: 2026,
        month: 8,
      })
      .expect(401);
  });

  it('protects municipal consolidation context', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/its2/municipal-consolidations/context')
      .expect(401);
  });

  it('protects the regional consolidation inbox', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/its2/municipal-consolidations/regional-inbox')
      .query({ year: 2026, month: 8 })
      .expect(401);
  });

  it('protects preparation of a regional consolidation', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/its2/regional-consolidations/prepare')
      .send({
        regionId: '11111111-1111-4111-8111-111111111111',
        year: 2026,
        month: 8,
      })
      .expect(401);
  });

  it('protects the central consolidation inbox', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/its2/regional-consolidations/central-inbox')
      .query({ year: 2026, month: 8 })
      .expect(401);
  });

  it('protects preparation of the national consolidation', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/its2/national-consolidations/prepare')
      .send({ year: 2026, month: 8 })
      .expect(401);
  });

  it('protects official national closure', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/its2/national-consolidations/11111111-1111-4111-8111-111111111111/close')
      .send({ reason: 'Cierre institucional autorizado' })
      .expect(401);
  });
});
