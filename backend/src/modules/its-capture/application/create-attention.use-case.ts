import { Injectable } from '@nestjs/common';
import { ItsAttentionRepository } from './ports/its-attention.repository';
import { type CreateAttentionInput, type CreatedAttention } from '../domain/its-attention';
import {
  normalizeAttention,
  validateAttention,
  validateCaptureReferences,
} from './attention-rules';

@Injectable()
export class CreateAttentionUseCase {
  constructor(private readonly repository: ItsAttentionRepository) {}

  async execute(
    input: CreateAttentionInput & { userId: string; requestId: string },
  ): Promise<CreatedAttention> {
    validateAttention(input);
    const normalized = normalizeAttention(input);
    const diseaseIds = input.diagnoses.map((item) => item.diseaseId);
    const references = await this.repository.resolveReferences({
      facilityId: input.facilityId,
      attentionDate: input.attentionDate,
      age: input.age,
      populationTypeId: input.populationTypeId,
      diseaseIds,
    });

    validateCaptureReferences(references, diseaseIds, input.sex);

    const possibleDuplicate = await this.repository.hasPossibleDuplicate({
      facilityId: input.facilityId,
      attentionDate: input.attentionDate,
      patientRecordNumber: normalized.patientRecordNumber,
    });
    return this.repository.create({
      ...normalized,
      possibleDuplicate,
      programId: references.programId,
      epidemiologicalWeekId: references.epidemiologicalWeekId,
      monthlyPeriodId: references.monthlyPeriodId,
      regionId: references.facility.regionId,
      municipalityId: references.facility.municipalityId,
      ageGroupId: references.ageGroupId,
      comparativeAgeGroupId: references.comparativeAgeGroupId,
    });
  }
}
