import { Injectable } from '@nestjs/common';
import { ItsAttentionRepository } from './ports/its-attention.repository';
import { type AttentionRecord, type UpdateAttentionInput } from '../domain/its-attention';
import {
  normalizeAttention,
  validateAttention,
  validateCaptureReferences,
} from './attention-rules';

@Injectable()
export class UpdateAttentionUseCase {
  constructor(private readonly repository: ItsAttentionRepository) {}

  async execute(
    input: UpdateAttentionInput & { userId: string; requestId: string },
  ): Promise<AttentionRecord> {
    validateAttention(input);
    const normalized = normalizeAttention(input);
    const diseaseIds = normalized.diagnoses.map((item) => item.diseaseId);
    const references = await this.repository.resolveReferences({
      facilityId: normalized.facilityId,
      attentionDate: normalized.attentionDate,
      age: normalized.age,
      populationTypeId: normalized.populationTypeId,
      diseaseIds,
    });
    validateCaptureReferences(references, diseaseIds, normalized.sex);

    const possibleDuplicate = await this.repository.hasPossibleDuplicate({
      facilityId: normalized.facilityId,
      attentionDate: normalized.attentionDate,
      patientRecordNumber: normalized.patientRecordNumber,
      excludeAttentionId: normalized.id,
    });
    return this.repository.update({
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
