import { PrismaExportJobRepository } from './prisma-export-job.repository';
import type { Prisma } from '../../../generated/prisma/client';

describe('PrismaExportJobRepository attempt fencing', () => {
  const claim = { id: '11111111-1111-4111-8111-111111111111', attempts: 2 };

  it.each([0, 1])('completes only the exact active claim (updated rows: %s)', async (count) => {
    const updateMany = jest.fn().mockResolvedValue({ count });
    const repository = new PrismaExportJobRepository({
      client: { exportJob: { updateMany } },
    } as never);
    const storageKey = `11/${claim.id}.attempt-2.xlsx`;
    const expiresAt = new Date('2026-09-01T00:00:00Z');

    await expect(repository.complete(claim, storageKey, expiresAt)).resolves.toBe(count === 1);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: claim.id, attempts: claim.attempts, status: 'PROCESANDO' },
      data: {
        status: 'COMPLETADO',
        outputStorageKey: storageKey,
        outputExpiresAt: expiresAt,
        errorCode: null,
        finishedAt: expect.any(Date),
      },
    });
  });

  it.each([0, 1])('fails only the exact active claim (updated rows: %s)', async (count) => {
    const updateMany = jest.fn().mockResolvedValue({ count });
    const repository = new PrismaExportJobRepository({
      client: { exportJob: { updateMany } },
    } as never);

    await expect(repository.fail(claim, 'EXPORT_GENERATION_FAILED')).resolves.toBe(count === 1);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: claim.id, attempts: claim.attempts, status: 'PROCESANDO' },
      data: {
        status: 'FALLIDO',
        errorCode: 'EXPORT_GENERATION_FAILED',
        finishedAt: expect.any(Date),
      },
    });
  });

  it('terminalizes a bounded batch of stale exhausted claims with audit in the same transaction', async () => {
    const queryRaw = jest
      .fn()
      .mockResolvedValue([{ id: claim.id, attempts: 3, reportType: 'ITS1_REGISTER' }]);
    const auditCreateMany = jest.fn().mockResolvedValue({ count: 1 });
    const transaction = { $queryRaw: queryRaw, auditEvent: { createMany: auditCreateMany } };
    const transact = jest.fn((operation: (tx: typeof transaction) => Promise<number>) =>
      operation(transaction),
    );
    const repository = new PrismaExportJobRepository({
      client: { $transaction: transact },
    } as never);
    const before = Date.now();

    await expect(repository.recoverStaleExhausted(900_000)).resolves.toBe(1);

    expect(transact).toHaveBeenCalledTimes(1);
    const statement = queryRaw.mock.calls[0][0] as Prisma.Sql;
    const cutoff = statement.values[0] as Date;
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(before - 900_000);
    expect(cutoff.getTime()).toBeLessThanOrEqual(Date.now() - 900_000);
    expect(statement.values).toContain(25);
    expect(statement.values).toContain('EXPORT_ATTEMPTS_EXHAUSTED');
    expect(statement.text).toContain('FOR UPDATE SKIP LOCKED');
    expect(statement.text).toContain('LIMIT $2');
    expect(statement.text).toContain('job."intentos" = exhausted."intentos"');
    expect(statement.text).toContain('job."estado" = \'PROCESANDO\'');
    expect(statement.text).toContain('job."intentos" >= job."max_intentos"');
    expect(statement.text).toContain('job."iniciado_at" < $4');
    expect(statement.text).not.toContain('"intentos" + 1');
    expect(auditCreateMany).toHaveBeenCalledWith({
      data: [
        {
          action: 'EXPORT_JOB_ATTEMPTS_EXHAUSTED',
          entity: 'EXPORT_JOB',
          entityId: claim.id,
          dataLevel: 'INDIVIDUAL',
          previousData: { status: 'PROCESANDO', attempts: 3 },
          newData: { status: 'FALLIDO', attempts: 3, errorCode: 'EXPORT_ATTEMPTS_EXHAUSTED' },
          reason: 'El último intento de exportación venció sin confirmar su finalización.',
          requestId: `export-worker:${claim.id}:attempt:3`,
        },
      ],
    });
  });

  it('does not emit audit events when no exhausted claim meets the stale CAS', async () => {
    const transaction = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      auditEvent: { createMany: jest.fn() },
    };
    const repository = new PrismaExportJobRepository({
      client: {
        $transaction: (operation: (tx: typeof transaction) => Promise<number>): Promise<number> =>
          operation(transaction),
      },
    } as never);

    await expect(repository.recoverStaleExhausted(900_000)).resolves.toBe(0);

    expect(transaction.auditEvent.createMany).not.toHaveBeenCalled();
  });

  it('rejects the recovery transaction if its audit cannot be persisted', async () => {
    const transaction = {
      $queryRaw: jest
        .fn()
        .mockResolvedValue([{ id: claim.id, attempts: 3, reportType: 'ITS2_MONTHLY' }]),
      auditEvent: { createMany: jest.fn().mockRejectedValue(new Error('audit unavailable')) },
    };
    const repository = new PrismaExportJobRepository({
      client: {
        $transaction: (operation: (tx: typeof transaction) => Promise<number>): Promise<number> =>
          operation(transaction),
      },
    } as never);

    await expect(repository.recoverStaleExhausted(900_000)).rejects.toThrow('audit unavailable');
  });

  it('never reclaims exhausted attempts after terminalization', async () => {
    const queryRaw = jest.fn().mockResolvedValue([]);
    const repository = new PrismaExportJobRepository({ client: { $queryRaw: queryRaw } } as never);

    await expect(repository.claimNext(900_000)).resolves.toBeNull();

    const statement = queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(statement.text).toContain('WHERE "intentos" < "max_intentos"');
  });
});
