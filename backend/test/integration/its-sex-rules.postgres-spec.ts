import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../../src/generated/prisma/client';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service';
import type { PersistAttentionInput } from '../../src/modules/its-capture/domain/its-attention';
import { PrismaItsAttentionRepository } from '../../src/modules/its-capture/infrastructure/prisma-its-attention.repository';
import { createQaClient, createQaFixture, deleteQaFixture, type QaFixture } from './qa-database';

describe('ITS1 PostgreSQL sex invariants and valid lifecycle', () => {
  let client: PrismaClient;
  let fixture: QaFixture | undefined;
  let repository: PrismaItsAttentionRepository;
  let attention: PersistAttentionInput;

  beforeAll(() => {
    client = createQaClient();
    repository = new PrismaItsAttentionRepository({ client } as PrismaService);
  });

  beforeEach(async () => {
    fixture = await createQaFixture(client);
    const marker = `QA-${randomUUID().slice(0, 8)}`;
    const facility = await client.healthFacility.create({
      data: { municipalityId: fixture.municipalityId, code: marker, name: marker, type: 'QA' },
    });
    attention = {
      facilityId: facility.id,
      attentionDate: fixture.date,
      patientRecordNumber: marker,
      originText: 'Registro sintético exclusivo de QA',
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
  });

  afterEach(async () => {
    if (fixture) await deleteQaFixture(client, fixture);
    fixture = undefined;
  });

  afterAll(async () => client?.$disconnect());

  async function restrictDiseaseTo(sex: 'H' | 'M'): Promise<void> {
    await client.itsDisease.update({
      where: { id: attention.diagnoses[0]!.diseaseId },
      data: { appliesToMale: sex === 'H', appliesToFemale: sex === 'M' },
    });
  }

  it.each(['H', 'M'] as const)(
    'creates, corrects and cancels a valid %s attention with audit',
    async (sex) => {
      await restrictDiseaseTo(sex);
      const created = await repository.create({ ...attention, sex });
      const corrected = await repository.update({
        ...attention,
        sex,
        id: created.id,
        expectedUpdatedAt: created.updatedAt,
        originText: 'Procedencia sintética corregida',
      });
      const cancelled = await repository.cancel({
        id: corrected.id,
        facilityId: attention.facilityId,
        expectedUpdatedAt: corrected.updatedAt,
        userId: attention.userId,
        requestId: randomUUID(),
        reason: 'Fin de prueba sintética aislada',
      });
      expect(cancelled.status).toBe('ANULADO');
      const stored = await client.itsAttention.findUniqueOrThrow({ where: { id: created.id } });
      expect(stored.status).toBe('ANULADO');
      expect(stored.sex).toBe(sex);
      expect(await client.auditEvent.count({ where: { entityId: created.id } })).toBe(3);
    },
  );

  it.each(['H', 'M'] as const)(
    'rolls back an incompatible %s diagnosis even below the API',
    async (sex) => {
      await restrictDiseaseTo(sex === 'H' ? 'M' : 'H');
      await expect(repository.create({ ...attention, sex })).rejects.toThrow();
      expect(await client.itsAttention.count({ where: { facilityId: attention.facilityId } })).toBe(
        0,
      );
      expect(await client.auditEvent.count({ where: { actorUserId: attention.userId } })).toBe(0);
    },
  );

  it('rejects male pregnancy at the database boundary and rolls back', async () => {
    await expect(repository.create({ ...attention, sex: 'H', isPregnant: true })).rejects.toThrow();
    expect(await client.itsAttention.count({ where: { facilityId: attention.facilityId } })).toBe(
      0,
    );
  });

  it('rejects direct sex changes incompatible with existing diagnoses', async () => {
    await restrictDiseaseTo('M');
    const created = await repository.create(attention);
    await expect(
      client.itsAttention.update({ where: { id: created.id }, data: { sex: 'H' } }),
    ).rejects.toThrow();
    expect((await client.itsAttention.findUniqueOrThrow({ where: { id: created.id } })).sex).toBe(
      'M',
    );
  });

  it('does not let catalog edits invalidate existing diagnoses or disable both sexes', async () => {
    await restrictDiseaseTo('M');
    await repository.create(attention);
    const diseaseId = attention.diagnoses[0]!.diseaseId;
    await expect(
      client.itsDisease.update({
        where: { id: diseaseId },
        data: { appliesToMale: true, appliesToFemale: false },
      }),
    ).rejects.toThrow();
    await expect(
      client.itsDisease.update({
        where: { id: diseaseId },
        data: { appliesToMale: false, appliesToFemale: false },
      }),
    ).rejects.toThrow();
    expect(await client.itsDisease.findUniqueOrThrow({ where: { id: diseaseId } })).toMatchObject({
      appliesToMale: false,
      appliesToFemale: true,
    });
  });
});
