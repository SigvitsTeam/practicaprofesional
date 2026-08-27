import { AttentionNotEditableError, type PersistAttentionInput } from '../domain/its-attention';
import { PrismaItsAttentionRepository } from './prisma-its-attention.repository';

describe('PrismaItsAttentionRepository.create', () => {
  const input: PersistAttentionInput = {
    facilityId: '11111111-1111-4111-8111-111111111111',
    attentionDate: new Date('2026-08-27T00:00:00.000Z'),
    patientRecordNumber: 'SMOKE-TEST',
    originText: 'Prueba',
    sex: 'M',
    age: 30,
    populationTypeId: '22222222-2222-4222-8222-222222222222',
    isContact: false,
    isPregnant: false,
    diagnoses: [{ diseaseId: '33333333-3333-4333-8333-333333333333', caseType: 'NUEVO' }],
    userId: '44444444-4444-4444-8444-444444444444',
    requestId: 'request-1',
    programId: '55555555-5555-4555-8555-555555555555',
    epidemiologicalWeekId: '66666666-6666-4666-8666-666666666666',
    monthlyPeriodId: '77777777-7777-4777-8777-777777777777',
    regionId: '88888888-8888-4888-8888-888888888888',
    municipalityId: '99999999-9999-4999-8999-999999999999',
    ageGroupId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    comparativeAgeGroupId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    possibleDuplicate: false,
  };

  it('blocks a new attention when the current ITS-2 report is already submitted', async () => {
    const transaction = {
      itsReport: {
        findFirst: jest.fn().mockResolvedValue({ id: 'report-1', status: 'ENVIADO_MUNICIPIO' }),
        update: jest.fn(),
      },
      itsAttention: { create: jest.fn() },
      auditEvent: { create: jest.fn() },
    };
    const prisma = {
      client: {
        $transaction: jest.fn((operation: (tx: typeof transaction) => unknown) =>
          operation(transaction),
        ),
      },
    };
    const repository = new PrismaItsAttentionRepository(prisma as never);

    await expect(repository.create(input)).rejects.toBeInstanceOf(AttentionNotEditableError);
    expect(transaction.itsAttention.create).not.toHaveBeenCalled();
  });
});
