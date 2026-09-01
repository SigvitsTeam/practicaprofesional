import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../../src/generated/prisma/client';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service';
import {
  ConcurrentAttentionUpdateError,
  type PersistAttentionInput,
} from '../../src/modules/its-capture/domain/its-attention';
import {
  ItsReportWorkflowError,
  type PrepareIts2ReportInput,
} from '../../src/modules/its-capture/domain/its-report-workflow';
import { PrismaItsAttentionRepository } from '../../src/modules/its-capture/infrastructure/prisma-its-attention.repository';
import { PrismaItsReportWorkflowRepository } from '../../src/modules/its-capture/infrastructure/prisma-its-report-workflow.repository';
import {
  createQaClient,
  createQaFixture,
  deleteQaFixture,
  requireQaDatabaseUrl,
  type QaFixture,
} from './qa-database';

interface Gate {
  reached: Promise<void>;
  pause: () => Promise<void>;
  release: () => void;
}

function createGate(): Gate {
  let notify!: () => void;
  let release!: () => void;
  const reached = new Promise<void>((resolve) => {
    notify = resolve;
  });
  const resume = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    reached,
    release,
    pause: async (): Promise<void> => {
      notify();
      await resume;
    },
  };
}

async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('QA barrier timed out')), 8_000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function service(client: unknown): PrismaService {
  return { client } as PrismaService;
}

// These are real PostgreSQL transactions. Extensions pause only after a real
// SELECT has completed, making the conflicting commit order deterministic.
describe('ITS1 / ITS2 PostgreSQL concurrency', () => {
  let client: PrismaClient;
  let fixture: QaFixture | undefined;
  let capture: PrismaItsAttentionRepository;
  let workflow: PrismaItsReportWorkflowRepository;
  let attention: PersistAttentionInput;
  let report: PrepareIts2ReportInput;

  beforeAll(async () => {
    const url = requireQaDatabaseUrl(process.env.QA_DATABASE_URL);
    client = createQaClient();
    const identity = await client.$queryRaw<
      Array<{ database: string }>
    >`SELECT current_database() AS database`;
    expect(identity[0]?.database).toBe(url.pathname.slice(1));
    fixture = await createQaFixture(client);
    capture = new PrismaItsAttentionRepository(service(client));
    workflow = new PrismaItsReportWorkflowRepository(service(client));
  });

  beforeEach(async () => {
    if (!fixture) throw new Error('QA fixture unavailable');
    const marker = `QA-${randomUUID().slice(0, 8)}`;
    const facility = await client.healthFacility.create({
      data: { municipalityId: fixture.municipalityId, code: marker, name: marker, type: 'QA' },
    });
    attention = {
      facilityId: facility.id,
      attentionDate: fixture.date,
      patientRecordNumber: marker,
      originText: 'Sintético; no corresponde a un paciente real',
      sex: 'M',
      age: 30,
      populationTypeId: fixture.populationTypeId,
      isContact: false,
      isPregnant: false,
      possibleDuplicate: false,
      diagnoses: [{ diseaseId: fixture.diseaseId, caseType: 'NUEVO' }],
      userId: fixture.userId,
      requestId: randomUUID(),
      programId: fixture.programId,
      epidemiologicalWeekId: fixture.weekId,
      monthlyPeriodId: fixture.periodId,
      regionId: fixture.regionId,
      municipalityId: fixture.municipalityId,
      ageGroupId: fixture.ageGroupId,
      comparativeAgeGroupId: fixture.comparativeAgeGroupId,
    };
    report = {
      facilityId: facility.id,
      year: fixture.year,
      month: fixture.month,
      userId: fixture.userId,
      attentionsUnder15: 0,
      attentions15Plus: 2,
      attentionTotalsSource: 'QA sintético',
    };
    await capture.create(attention);
  });

  afterAll(async () => {
    try {
      if (fixture) await deleteQaFixture(client, fixture);
    } finally {
      await client?.$disconnect();
    }
  });

  async function assertCurrentTotal(expected: number): Promise<void> {
    const current = await workflow.getCurrent(report);
    expect(current?.totalAttentions).toBe(expected);
    const details = await client.itsReportDetail.aggregate({
      where: { reportId: current!.id },
      _sum: { total: true },
    });
    expect(details._sum.total).toBe(expected);
  }

  function pausedPreparation(
    gate: Gate,
    phase: 'source' | 'current',
  ): PrismaItsReportWorkflowRepository {
    const instrumented = client.$extends({
      query: {
        itsAttention: {
          async findMany({ args, query }): Promise<Awaited<ReturnType<typeof query>>> {
            const rows = await query(args);
            if (phase === 'source') await gate.pause();
            return rows;
          },
        },
        itsReport: {
          async findFirst({ args, query }): Promise<Awaited<ReturnType<typeof query>>> {
            const row = await query(args);
            if (phase === 'current' && args.where?.isCurrentVersion === true) await gate.pause();
            return row;
          },
        },
      },
    });
    return new PrismaItsReportWorkflowRepository(service(instrumented));
  }

  it('prepares the next historical version after ITS1 invalidates a draft', async () => {
    const first = await workflow.prepare(report);
    await capture.create({ ...attention, patientRecordNumber: 'QA-second' });
    expect(await workflow.getCurrent(report)).toBeUndefined();
    const second = await workflow.prepare(report);
    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
    await assertCurrentTotal(2);
  });

  it.each(['source', 'current'] as const)(
    'rejects stale preparation when capture commits after the %s read',
    async (phase) => {
      if (phase === 'current') await workflow.prepare(report);
      const gate = createGate();
      const preparing = pausedPreparation(gate, phase).prepare(report);
      const result = expect(preparing).rejects.toBeInstanceOf(ItsReportWorkflowError);
      try {
        await bounded(gate.reached);
        await capture.create({ ...attention, patientRecordNumber: 'QA-concurrent' });
      } finally {
        gate.release();
      }
      await result;
      expect(await workflow.getCurrent(report)).toBeUndefined();
      await workflow.prepare(report);
      await assertCurrentTotal(2);
    },
  );

  it('does not recalculate details after a concurrent submission commits', async () => {
    const first = await workflow.prepare(report);
    const gate = createGate();
    const preparing = pausedPreparation(gate, 'current').prepare({
      ...report,
      attentions15Plus: 999,
    });
    const result = expect(preparing).rejects.toBeInstanceOf(ItsReportWorkflowError);
    try {
      await bounded(gate.reached);
      await workflow.submit(first.id, report.userId);
    } finally {
      gate.release();
    }
    await result;
    const current = await workflow.getCurrent(report);
    expect(current?.status).toBe('ENVIADO_A_MUNICIPIO');
    expect(current?.attentions15Plus).toBe(2);
    await assertCurrentTotal(1);
  });

  it('does not submit after a concurrent preparation clears completeness', async () => {
    const first = await workflow.prepare(report);
    const gate = createGate();
    const instrumented = client.$extends({
      query: {
        itsReport: {
          async findUnique({ args, query }): Promise<Awaited<ReturnType<typeof query>>> {
            const row = await query(args);
            if (args.select?.isCurrentVersion === true) await gate.pause();
            return row;
          },
        },
      },
    });
    const submitting = new PrismaItsReportWorkflowRepository(service(instrumented)).submit(
      first.id,
      report.userId,
    );
    const result = expect(submitting).rejects.toBeInstanceOf(ItsReportWorkflowError);
    try {
      await bounded(gate.reached);
      await workflow.prepare({ ...report, attentionTotalsSource: undefined });
    } finally {
      gate.release();
    }
    await result;
    const current = await workflow.getCurrent(report);
    expect(current?.status).toBe('BORRADOR');
    expect(current?.attentionTotalsComplete).toBe(false);
  });

  it('rejects a capture whose report was concurrently submitted', async () => {
    const first = await workflow.prepare(report);
    const gate = createGate();
    const instrumented = client.$extends({
      query: {
        itsReport: {
          async findFirst({ args, query }): Promise<Awaited<ReturnType<typeof query>>> {
            const row = await query(args);
            if (args.where?.isCurrentVersion === true) await gate.pause();
            return row;
          },
        },
      },
    });
    const creating = new PrismaItsAttentionRepository(service(instrumented)).create({
      ...attention,
      patientRecordNumber: 'QA-race-submit',
    });
    const result = expect(creating).rejects.toBeInstanceOf(ConcurrentAttentionUpdateError);
    try {
      await bounded(gate.reached);
      await workflow.submit(first.id, report.userId);
    } finally {
      gate.release();
    }
    await result;
    expect(await client.itsAttention.count({ where: { facilityId: report.facilityId } })).toBe(1);
    await assertCurrentTotal(1);
  });

  it('allows only one of two concurrent first preparations to publish version 1', async () => {
    const left = createGate();
    const right = createGate();
    const results = Promise.allSettled([
      pausedPreparation(left, 'source').prepare(report),
      pausedPreparation(right, 'source').prepare(report),
    ]);
    try {
      await bounded(Promise.all([left.reached, right.reached]));
    } finally {
      left.release();
      right.release();
    }
    const outcomes = await results;
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = outcomes.find((result) => result.status === 'rejected');
    expect(rejected?.reason).toBeInstanceOf(ItsReportWorkflowError);
    expect(await client.itsReport.count({ where: { facilityId: report.facilityId } })).toBe(1);
    await assertCurrentTotal(1);
  });
});
