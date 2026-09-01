import { UpdateAttentionUseCase } from './update-attention.use-case';
import { ItsAttentionRepository } from './ports/its-attention.repository';

describe('UpdateAttentionUseCase', () => {
  const resolveReferences = jest.fn();
  const hasPossibleDuplicate = jest.fn();
  const update = jest.fn();
  const repository = {
    resolveReferences,
    hasPossibleDuplicate,
    update,
  } as unknown as jest.Mocked<ItsAttentionRepository>;
  const useCase = new UpdateAttentionUseCase(repository);
  const input = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    facilityId: '11111111-1111-4111-8111-111111111111',
    attentionDate: new Date('2026-08-10T00:00:00.000Z'),
    expectedUpdatedAt: new Date('2026-08-11T12:00:00.000Z'),
    patientRecordNumber: ' exp-100 ',
    originText: ' Barrio Centro ',
    sex: 'M' as const,
    age: 30,
    populationTypeId: '22222222-2222-4222-8222-222222222222',
    isContact: false,
    isPregnant: false,
    diagnoses: [{ diseaseId: '33333333-3333-4333-8333-333333333333', caseType: 'NUEVO' }] as const,
    userId: 'user-1',
    requestId: 'request-1',
  };

  beforeEach(() => {
    jest.resetAllMocks();
    resolveReferences.mockResolvedValue({
      facility: { id: input.facilityId, municipalityId: 'municipality-1', regionId: 'region-1' },
      programId: 'program-1',
      epidemiologicalWeekId: 'week-1',
      monthlyPeriodId: 'period-1',
      ageGroupId: 'age-1',
      comparativeAgeGroupId: 'comparative-1',
      populationTypeValid: true,
      diseases: [{ id: input.diagnoses[0].diseaseId, appliesToMale: true, appliesToFemale: true }],
    });
    hasPossibleDuplicate.mockResolvedValue(false);
    update.mockResolvedValue({ id: input.id });
  });

  it('normalizes the correction and excludes itself from duplicate detection', async () => {
    await useCase.execute(input);
    expect(hasPossibleDuplicate).toHaveBeenCalledWith(
      expect.objectContaining({
        patientRecordNumber: 'EXP-100',
        excludeAttentionId: input.id,
      }),
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: input.id,
        expectedUpdatedAt: input.expectedUpdatedAt,
        originText: 'Barrio Centro',
      }),
    );
  });

  it('rejects a correction that changes to an incompatible disease and sex', async () => {
    resolveReferences.mockResolvedValueOnce({
      facility: { id: input.facilityId, municipalityId: 'municipality-1', regionId: 'region-1' },
      programId: 'program-1',
      epidemiologicalWeekId: 'week-1',
      monthlyPeriodId: 'period-1',
      ageGroupId: 'age-1',
      comparativeAgeGroupId: 'comparative-1',
      populationTypeValid: true,
      diseases: [{ id: input.diagnoses[0].diseaseId, appliesToMale: true, appliesToFemale: false }],
    });
    await expect(useCase.execute(input)).rejects.toThrow(
      'Una enfermedad seleccionada no es válida para sexo Mujer.',
    );
    expect(update).not.toHaveBeenCalled();
  });
});
