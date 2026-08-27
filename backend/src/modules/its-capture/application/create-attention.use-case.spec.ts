import { CreateAttentionUseCase } from './create-attention.use-case';
import { ItsAttentionRepository } from './ports/its-attention.repository';
import { CaptureConfigurationError, InvalidAttentionError } from '../domain/its-attention';

const ids = {
  facility: '11111111-1111-4111-8111-111111111111',
  population: '22222222-2222-4222-8222-222222222222',
  disease: '33333333-3333-4333-8333-333333333333',
};

describe('CreateAttentionUseCase', () => {
  const resolveReferences = jest.fn();
  const hasPossibleDuplicate = jest.fn();
  const create = jest.fn();
  const repository = {
    resolveReferences,
    hasPossibleDuplicate,
    create,
  } as unknown as jest.Mocked<ItsAttentionRepository>;
  const useCase = new CreateAttentionUseCase(repository);
  const validInput = {
    facilityId: ids.facility,
    attentionDate: new Date('2026-07-28T00:00:00.000Z'),
    patientRecordNumber: ' exp-001 ',
    originText: ' Barrio Centro ',
    sex: 'M' as const,
    age: 24,
    populationTypeId: ids.population,
    isContact: false,
    isPregnant: true,
    diagnoses: [{ diseaseId: ids.disease, caseType: 'NUEVO' as const }],
    userId: 'user-1',
    requestId: 'request-1',
  };
  const references = {
    facility: { id: ids.facility, municipalityId: 'municipality-1', regionId: 'region-1' },
    programId: 'program-1',
    epidemiologicalWeekId: 'week-1',
    monthlyPeriodId: 'period-1',
    ageGroupId: 'age-1',
    comparativeAgeGroupId: 'comparative-1',
    populationTypeValid: true,
    diseases: [{ id: ids.disease, appliesToMale: true, appliesToFemale: true }],
  };

  beforeEach(() => {
    jest.resetAllMocks();
    resolveReferences.mockResolvedValue(references);
    hasPossibleDuplicate.mockResolvedValue(false);
    create.mockResolvedValue({
      id: 'attention-1',
      possibleDuplicate: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it('normalizes and persists a valid attention with resolved institutional context', async () => {
    await useCase.execute(validInput);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        patientRecordNumber: 'EXP-001',
        originText: 'Barrio Centro',
        regionId: 'region-1',
        municipalityId: 'municipality-1',
      }),
    );
  });

  it('rejects pregnancy for a male patient before accessing persistence', async () => {
    await expect(
      useCase.execute({ ...validInput, sex: 'H', isPregnant: true }),
    ).rejects.toBeInstanceOf(InvalidAttentionError);
    expect(resolveReferences).not.toHaveBeenCalled();
  });

  it('rejects diseases that do not apply to the registered sex', async () => {
    resolveReferences.mockResolvedValue({
      ...references,
      diseases: [{ id: ids.disease, appliesToMale: false, appliesToFemale: true }],
    });
    await expect(useCase.execute({ ...validInput, sex: 'H', isPregnant: false })).rejects.toThrow(
      'Una enfermedad seleccionada no es válida para sexo Hombre.',
    );
  });

  it('rejects male-only diseases for a female patient', async () => {
    resolveReferences.mockResolvedValue({
      ...references,
      diseases: [{ id: ids.disease, appliesToMale: true, appliesToFemale: false }],
    });
    await expect(useCase.execute(validInput)).rejects.toThrow(
      'Una enfermedad seleccionada no es válida para sexo Mujer.',
    );
  });

  it('blocks capture when the monthly period is not open', async () => {
    resolveReferences.mockResolvedValue({ ...references, monthlyPeriodId: undefined });
    await expect(useCase.execute(validInput)).rejects.toBeInstanceOf(CaptureConfigurationError);
  });
});
