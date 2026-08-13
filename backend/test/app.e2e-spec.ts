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
});
