import { Prisma } from '../../../generated/prisma/client';
import { ItsReportWorkflowError, type PrepareIts2ReportInput } from '../domain/its-report-workflow';
import { PrismaItsReportWorkflowRepository } from './prisma-its-report-workflow.repository';

describe('PrismaItsReportWorkflowRepository concurrency and versions', () => {
  const input: PrepareIts2ReportInput = {
    facilityId: 'facility-1',
    userId: 'user-1',
    year: 2026,
    month: 8,
    attentionsUnder15: 10,
    attentions15Plus: 20,
    attentionTotalsSource: 'Registro diario',
  };

  function setup(): {
    repository: PrismaItsReportWorkflowRepository;
    transaction: {
      healthProgram: { findFirst: jest.Mock };
      reportingPeriod: { findFirst: jest.Mock };
      healthFacility: { findFirst: jest.Mock };
      itsAttention: { findMany: jest.Mock };
      itsReport: {
        findFirst: jest.Mock;
        findUnique: jest.Mock;
        create: jest.Mock;
        updateMany: jest.Mock;
      };
      itsReportDetail: { deleteMany: jest.Mock; createMany: jest.Mock };
      reportObservation: { updateMany: jest.Mock; create: jest.Mock };
      reportFlowHistory: { create: jest.Mock };
      auditEvent: { create: jest.Mock };
    };
    transact: jest.Mock;
    selectedReport: Record<string, unknown>;
  } {
    const selectedReport = {
      id: 'report-new',
      status: 'BORRADOR',
      version: 1,
      municipalityId: 'municipality-1',
      attentionsUnder15: 10,
      attentions15Plus: 20,
      attentionTotalsSource: 'Registro diario',
      attentionTotalsComplete: true,
      sourceAttentionCount: 0,
      currentComment: null,
      generatedAt: new Date('2026-08-31T00:00:00Z'),
      sentAt: null,
      approvedAt: null,
      facility: { id: 'facility-1', code: 'F1', name: 'Centro de prueba' },
      period: { year: 2026, month: 8 },
      observations: [],
    };
    const transaction = {
      healthProgram: { findFirst: jest.fn().mockResolvedValue({ id: 'program-1' }) },
      reportingPeriod: {
        findFirst: jest.fn().mockResolvedValue({ id: 'period-1', status: 'ABIERTO' }),
      },
      healthFacility: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'facility-1',
          municipalityId: 'municipality-1',
          municipality: { regionId: 'region-1' },
        }),
      },
      itsAttention: { findMany: jest.fn().mockResolvedValue([]) },
      itsReport: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(selectedReport),
        create: jest.fn().mockResolvedValue({ id: 'report-new' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      itsReportDetail: { deleteMany: jest.fn(), createMany: jest.fn() },
      reportObservation: { updateMany: jest.fn(), create: jest.fn() },
      reportFlowHistory: { create: jest.fn() },
      auditEvent: { create: jest.fn() },
    };
    const transact = jest.fn((operation: (tx: typeof transaction) => Promise<unknown>) =>
      operation(transaction),
    );
    const repository = new PrismaItsReportWorkflowRepository({
      client: { $transaction: transact },
    } as never);
    return { repository, transaction, transact, selectedReport };
  }

  it('starts at version 1 only when there are no historical reports', async () => {
    const { repository, transaction } = setup();
    await repository.prepare(input);
    expect(transaction.itsReport.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ version: 1 }),
      select: { id: true },
    });
  });

  it('increments historical version after capture invalidates the current report', async () => {
    const { repository, transaction } = setup();
    transaction.itsReport.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ version: 4 });

    await repository.prepare(input);

    expect(transaction.itsReport.findFirst).toHaveBeenNthCalledWith(2, {
      where: { periodId: 'period-1', facilityId: 'facility-1' },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    expect(transaction.itsReport.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ version: 5 }),
      select: { id: true },
    });
  });

  it('recalculates a current draft without allocating a new version', async () => {
    const { repository, transaction } = setup();
    transaction.itsReport.findFirst.mockResolvedValue({
      id: 'report-current',
      status: 'BORRADOR',
      version: 3,
    });

    await repository.prepare(input);

    expect(transaction.itsReport.findFirst).toHaveBeenCalledTimes(1);
    expect(transaction.itsReport.create).not.toHaveBeenCalled();
    expect(transaction.itsReport.updateMany).toHaveBeenCalledWith({
      where: { id: 'report-current', status: 'BORRADOR', isCurrentVersion: true },
      data: expect.objectContaining({ sourceAttentionCount: 0 }),
    });
    expect(transaction.itsReportDetail.deleteMany).toHaveBeenCalledWith({
      where: { reportId: 'report-current' },
    });
  });

  it('creates the next version of a returned report and resolves its observations', async () => {
    const { repository, transaction } = setup();
    transaction.itsReport.findFirst
      .mockResolvedValueOnce({
        id: 'report-returned',
        status: 'DEVUELTO_POR_MUNICIPIO',
        version: 3,
      })
      .mockResolvedValueOnce({ version: 3 });

    await repository.prepare(input);

    expect(transaction.itsReport.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'report-returned',
        status: 'DEVUELTO_POR_MUNICIPIO',
        isCurrentVersion: true,
      },
      data: { isCurrentVersion: false },
    });
    expect(transaction.reportObservation.updateMany).toHaveBeenCalledWith({
      where: { reportId: 'report-returned', status: 'ABIERTA' },
      data: { status: 'RESUELTA' },
    });
    expect(transaction.itsReport.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ version: 4 }),
      select: { id: true },
    });
  });

  it.each(['ENVIADO_A_MUNICIPIO', 'APROBADO_MUNICIPIO'])(
    'does not replace the snapshot of a report in %s',
    async (status) => {
      const { repository, transaction } = setup();
      transaction.itsReport.findFirst.mockResolvedValue({
        id: 'report-current',
        status,
        version: 1,
      });

      await expect(repository.prepare(input)).rejects.toBeInstanceOf(ItsReportWorkflowError);
      expect(transaction.itsReport.updateMany).not.toHaveBeenCalled();
      expect(transaction.itsReportDetail.deleteMany).not.toHaveBeenCalled();
      expect(transaction.itsReport.create).not.toHaveBeenCalled();
    },
  );

  it.each(['BORRADOR', 'DEVUELTO_POR_MUNICIPIO'])(
    'stops preparation if the current %s report changes before the guarded write',
    async (status) => {
      const { repository, transaction } = setup();
      transaction.itsReport.findFirst.mockResolvedValue({
        id: 'report-current',
        status,
        version: 1,
      });
      transaction.itsReport.updateMany.mockResolvedValue({ count: 0 });

      await expect(repository.prepare(input)).rejects.toBeInstanceOf(ItsReportWorkflowError);
      expect(transaction.itsReportDetail.deleteMany).not.toHaveBeenCalled();
      expect(transaction.itsReportDetail.createMany).not.toHaveBeenCalled();
      expect(transaction.itsReport.create).not.toHaveBeenCalled();
      expect(transaction.auditEvent.create).not.toHaveBeenCalled();
    },
  );

  it('prepares source rows and details in one serializable transaction', async () => {
    const { repository, transact } = setup();
    await repository.prepare(input);
    expect(transact).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 30_000,
    });
  });

  it('also isolates submission so completeness cannot change after validation', async () => {
    const { repository, transaction, transact, selectedReport } = setup();
    transaction.itsReport.findUnique
      .mockResolvedValueOnce({
        status: 'BORRADOR',
        isCurrentVersion: true,
        attentionTotalsComplete: true,
        period: { status: 'ABIERTO' },
      })
      .mockResolvedValueOnce({ ...selectedReport, status: 'ENVIADO_A_MUNICIPIO' });

    await repository.submit('report-current', 'user-1');

    expect(transact).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 30_000,
    });
    expect(transaction.itsReport.updateMany).toHaveBeenCalledWith({
      where: { id: 'report-current', status: 'BORRADOR', isCurrentVersion: true },
      data: expect.objectContaining({ status: 'ENVIADO_A_MUNICIPIO' }),
    });
  });

  it.each(['P2034', 'P2002'])(
    'maps preparation conflict %s to a controlled workflow error',
    async (code) => {
      const { repository, transact } = setup();
      transact.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('concurrent operation', {
          code,
          clientVersion: 'test',
        }),
      );
      await expect(repository.prepare(input)).rejects.toBeInstanceOf(ItsReportWorkflowError);
      expect(transact).toHaveBeenCalledTimes(1);
    },
  );

  it('maps submission serialization conflicts to a controlled workflow error', async () => {
    const { repository, transact } = setup();
    transact.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('concurrent operation', {
        code: 'P2034',
        clientVersion: 'test',
      }),
    );
    await expect(repository.submit('report-current', 'user-1')).rejects.toBeInstanceOf(
      ItsReportWorkflowError,
    );
  });

  it('does not mask unrelated database failures as concurrency conflicts', async () => {
    const { repository, transact } = setup();
    const unavailable = new Error('database unavailable');
    transact.mockRejectedValue(unavailable);
    await expect(repository.prepare(input)).rejects.toBe(unavailable);
  });
});
