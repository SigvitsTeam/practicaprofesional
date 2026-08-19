import {
  CaptureConfigurationError,
  InvalidAttentionError,
  type AttentionDiagnosisInput,
  type BiologicalSex,
  type CaptureReferences,
  type CreateAttentionInput,
} from '../domain/its-attention';

export function validateAttention(input: CreateAttentionInput): void {
  if (!input.patientRecordNumber.trim() || input.patientRecordNumber.trim().length < 4)
    throw new InvalidAttentionError('El número de expediente es obligatorio.');
  if (!input.originText.trim() || input.originText.trim().length < 3)
    throw new InvalidAttentionError('La procedencia es obligatoria.');
  if (!Number.isInteger(input.age) || input.age < 0 || input.age > 120)
    throw new InvalidAttentionError('La edad debe estar entre 0 y 120 años.');
  if (input.sex === 'H' && input.isPregnant)
    throw new InvalidAttentionError(
      'Un paciente de sexo hombre no puede registrarse como embarazado.',
    );
  if (input.diagnoses.length === 0)
    throw new InvalidAttentionError('Debe registrar al menos un diagnóstico.');
  const keys = input.diagnoses.map((item) => `${item.diseaseId}:${item.caseType}`);
  if (new Set(keys).size !== keys.length)
    throw new InvalidAttentionError('No se puede duplicar la misma enfermedad y tipo de caso.');
}

export function validateCaptureReferences(
  references: CaptureReferences,
  diseaseIds: readonly string[],
  sex: BiologicalSex,
): asserts references is CaptureReferences & {
  facility: NonNullable<CaptureReferences['facility']>;
  programId: string;
  epidemiologicalWeekId: string;
  monthlyPeriodId: string;
  ageGroupId: string;
  comparativeAgeGroupId: string;
} {
  if (!references.facility)
    throw new CaptureConfigurationError('El establecimiento no existe o no está activo.');
  if (!references.programId)
    throw new CaptureConfigurationError('El programa ITS no está configurado.');
  if (!references.epidemiologicalWeekId)
    throw new CaptureConfigurationError('No existe semana epidemiológica activa para la fecha.');
  if (!references.monthlyPeriodId)
    throw new CaptureConfigurationError('El período mensual no está abierto.');
  if (!references.ageGroupId || !references.comparativeAgeGroupId)
    throw new CaptureConfigurationError('La edad no tiene grupos configurados.');
  if (!references.populationTypeValid)
    throw new InvalidAttentionError('El tipo de población no es válido.');
  if (references.diseases.length !== new Set(diseaseIds).size)
    throw new InvalidAttentionError('Una o más enfermedades no son válidas.');
  const incompatible = references.diseases.some((disease) =>
    sex === 'H' ? !disease.appliesToMale : !disease.appliesToFemale,
  );
  if (incompatible)
    throw new InvalidAttentionError('Una enfermedad seleccionada no aplica al sexo registrado.');
}

export function normalizeAttention<T extends CreateAttentionInput>(input: T): T {
  return {
    ...input,
    patientRecordNumber: input.patientRecordNumber.trim().toUpperCase(),
    originText: input.originText.trim(),
    observation: input.observation?.trim() || undefined,
    diagnoses: input.diagnoses.map((diagnosis: AttentionDiagnosisInput) => ({ ...diagnosis })),
  };
}
