import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '../../src/generated/prisma/client';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service';
import type {
  ClaimedExportJob,
  CreateExportJobInput,
  ExportJob,
} from '../../src/modules/exports/domain/export-job';
import { PrismaExportJobRepository } from '../../src/modules/exports/infrastructure/prisma-export-job.repository';
import { createQaClient, requireQaDatabaseUrl } from './qa-database';

const staleAfterMs = 60_000;

describe('Export worker PostgreSQL claims and exhausted recovery', () => {
  let client: PrismaClient;
  let repository: PrismaExportJobRepository;
  let userId: string | undefined;
  const ownedJobIds: string[] = [];

  beforeAll(async () => {
    const url = requireQaDatabaseUrl(process.env.QA_DATABASE_URL);
    client = createQaClient();
    const identity = await client.$queryRaw<
      Array<{ database: string }>
    >`SELECT current_database() AS database`;
    expect(identity[0]?.database).toBe(url.pathname.slice(1));
    // Queue operations are intentionally global. Refuse a populated QA queue;
    // these tests must not consume jobs created by a different test or worker.
    expect(await client.exportJob.count()).toBe(0);
    const marker = randomUUID();
    const user = await client.appUser.create({
      data: { fullName: `QA export ${marker}`, email: `qa-export-${marker}@example.invalid` },
    });
    userId = user.id;
    repository = new PrismaExportJobRepository({ client } as PrismaService);
  });

  beforeEach(async () => {
    expect(await client.exportJob.count()).toBe(0);
  });

  async function deleteOwnedJobs(): Promise<void> {
    if (!client || !userId || ownedJobIds.length === 0) return;
    const jobIds = [...ownedJobIds];
    await client.$transaction(async (tx) => {
      // Exhaustion events have no actorUserId; match their exact entity IDs too.
      await tx.auditEvent.deleteMany({
        where: { entity: 'EXPORT_JOB', entityId: { in: jobIds } },
      });
      await tx.exportJob.deleteMany({
        where: { requestedByUserId: userId, id: { in: jobIds } },
      });
    });
    ownedJobIds.length = 0;
  }

  afterEach(async () => {
    await deleteOwnedJobs();
  });

  afterAll(async () => {
    try {
      await deleteOwnedJobs();
      if (userId) await client.appUser.delete({ where: { id: userId } });
    } finally {
      await client?.$disconnect();
    }
  });

  async function enqueue(overrides: Partial<CreateExportJobInput> = {}): Promise<ExportJob> {
    if (!userId) throw new Error('Export QA user was not initialized.');
    const job = await repository.create({
      requestedByUserId: userId,
      idempotencyKey: randomUUID(),
      reportType: 'ITS2_MONTHLY',
      format: 'XLSX',
      scopeLevel: 'ESTABLECIMIENTO',
      territoryId: randomUUID(),
      year: 2026,
      month: 8,
      requestId: `qa-export:${randomUUID()}`,
      ...overrides,
    });
    ownedJobIds.push(job.id);
    return job;
  }

  async function claim(): Promise<ClaimedExportJob> {
    const job = await repository.claimNext(staleAfterMs);
    if (!job) throw new Error('Expected a synthetic export job to be claimable.');
    expect(ownedJobIds).toContain(job.id);
    return job;
  }

  async function expire(jobId: string, exhausted = false): Promise<void> {
    await client.exportJob.update({
      where: { id: jobId },
      data: {
        status: 'PROCESANDO',
        startedAt: new Date(Date.now() - staleAfterMs * 2),
        ...(exhausted ? { attempts: 3, maxAttempts: 3 } : {}),
      },
    });
  }

  it('grants a pending job to only one of eight concurrent claimers', async () => {
    const queued = await enqueue();
    const attempts = await Promise.all(
      Array.from({ length: 8 }, () => repository.claimNext(staleAfterMs)),
    );
    const claimed = attempts.filter((job) => job !== null);
    expect(claimed).toHaveLength(1);
    expect(claimed[0]).toMatchObject({ id: queued.id, attempts: 1, status: 'PROCESANDO' });
    expect(attempts.filter((job) => job === null)).toHaveLength(7);
    expect(await client.exportJob.findUnique({ where: { id: queued.id } })).toMatchObject({
      attempts: 1,
      status: 'PROCESANDO',
    });
  });

  it('reclaims an expired lease with a larger attempt and accepts failure only for that claim', async () => {
    await enqueue();
    const first = await claim();
    expect(await repository.claimNext(staleAfterMs)).toBeNull();
    await expire(first.id);
    const second = await claim();
    expect(second.id).toBe(first.id);
    expect(second.attempts).toBe(first.attempts + 1);
    expect(await repository.fail(second, 'QA_CURRENT_ATTEMPT_FAILED')).toBe(true);
    expect(await client.exportJob.findUnique({ where: { id: first.id } })).toMatchObject({
      attempts: 2,
      status: 'FALLIDO',
      errorCode: 'QA_CURRENT_ATTEMPT_FAILED',
    });
  });

  it('fences stale complete and fail without modifying the active or completed successor', async () => {
    await enqueue();
    const first = await claim();
    await expire(first.id);
    const current = await claim();
    const before = await client.exportJob.findUniqueOrThrow({ where: { id: first.id } });
    const expiresAt = new Date(Date.now() + 60_000);
    const oldKey = `${first.id.slice(0, 2)}/${first.id}.attempt-${first.attempts}.xlsx`;
    const currentKey = `${current.id.slice(0, 2)}/${current.id}.attempt-${current.attempts}.xlsx`;
    expect(
      await Promise.all([
        repository.complete(first, oldKey, expiresAt),
        repository.fail(first, 'QA_STALE_ATTEMPT_FAILED'),
      ]),
    ).toEqual([false, false]);
    expect(await client.exportJob.findUniqueOrThrow({ where: { id: first.id } })).toEqual(before);

    expect(await repository.complete(current, currentKey, expiresAt)).toBe(true);
    expect(await repository.complete(first, oldKey, expiresAt)).toBe(false);
    expect(await repository.fail(first, 'QA_LATE_STALE_FAILURE')).toBe(false);
    expect(await client.exportJob.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({
      status: 'COMPLETADO',
      attempts: current.attempts,
      outputStorageKey: currentKey,
      outputExpiresAt: expiresAt,
      errorCode: null,
    });
  });

  it('terminalizes the last expired attempt once with one audit and no further claim', async () => {
    const queued = await enqueue({ reportType: 'ITS1_REGISTER' });
    await expire(queued.id, true);
    const recovered = await Promise.all([
      repository.recoverStaleExhausted(staleAfterMs),
      repository.recoverStaleExhausted(staleAfterMs),
    ]);
    expect(recovered.reduce((total, count) => total + count, 0)).toBe(1);
    expect(await repository.recoverStaleExhausted(staleAfterMs)).toBe(0);
    expect(await repository.claimNext(staleAfterMs)).toBeNull();
    expect(await client.exportJob.findUniqueOrThrow({ where: { id: queued.id } })).toMatchObject({
      status: 'FALLIDO',
      attempts: 3,
      errorCode: 'EXPORT_ATTEMPTS_EXHAUSTED',
      finishedAt: expect.any(Date),
    });
    const audit = await client.auditEvent.findMany({
      where: { entity: 'EXPORT_JOB', entityId: queued.id, action: 'EXPORT_JOB_ATTEMPTS_EXHAUSTED' },
    });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      dataLevel: 'INDIVIDUAL',
      previousData: { status: 'PROCESANDO', attempts: 3 },
      newData: { status: 'FALLIDO', attempts: 3, errorCode: 'EXPORT_ATTEMPTS_EXHAUSTED' },
      requestId: `export-worker:${queued.id}:attempt:3`,
    });
  });

  it('recovers at most 25 exhausted jobs per poll and leaves a fresh final attempt running', async () => {
    const fixtureUserId = userId;
    if (!fixtureUserId) throw new Error('Export QA user was not initialized.');
    const staleIds = Array.from({ length: 26 }, () => randomUUID());
    const freshId = randomUUID();
    ownedJobIds.push(...staleIds, freshId);
    const startedAt = new Date(Date.now() - staleAfterMs * 2);
    await client.exportJob.createMany({
      data: [...staleIds, freshId].map((id) => ({
        id,
        requestedByUserId: fixtureUserId,
        idempotencyKey: randomUUID(),
        reportType: 'ITS2_MONTHLY',
        format: 'XLSX',
        scopeLevel: 'NACIONAL',
        year: 2026,
        month: 8,
        status: 'PROCESANDO',
        attempts: 3,
        maxAttempts: 3,
        startedAt: id === freshId ? new Date() : startedAt,
      })),
    });
    expect(await repository.recoverStaleExhausted(staleAfterMs)).toBe(25);
    expect(
      await client.exportJob.count({ where: { id: { in: staleIds }, status: 'FALLIDO' } }),
    ).toBe(25);
    expect(
      await client.auditEvent.count({
        where: { entityId: { in: staleIds }, action: 'EXPORT_JOB_ATTEMPTS_EXHAUSTED' },
      }),
    ).toBe(25);
    expect(await repository.recoverStaleExhausted(staleAfterMs)).toBe(1);
    expect(await repository.recoverStaleExhausted(staleAfterMs)).toBe(0);
    expect(await repository.claimNext(staleAfterMs)).toBeNull();
    expect(
      await client.auditEvent.count({
        where: { entityId: { in: staleIds }, action: 'EXPORT_JOB_ATTEMPTS_EXHAUSTED' },
      }),
    ).toBe(26);
    expect(await client.exportJob.findUniqueOrThrow({ where: { id: freshId } })).toMatchObject({
      status: 'PROCESANDO',
      attempts: 3,
      errorCode: null,
      finishedAt: null,
    });
  });
});
