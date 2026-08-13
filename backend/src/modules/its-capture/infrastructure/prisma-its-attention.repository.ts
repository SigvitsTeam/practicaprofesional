import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ItsAttentionRepository } from '../application/ports/its-attention.repository';
import type {
  CaptureReferences,
  CreatedAttention,
  PersistAttentionInput,
} from '../domain/its-attention';

@Injectable()
export class PrismaItsAttentionRepository extends ItsAttentionRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async resolveReferences(input: {
    facilityId: string;
    attentionDate: Date;
    age: number;
    populationTypeId: string;
    diseaseIds: readonly string[];
  }): Promise<CaptureReferences> {
    const year = input.attentionDate.getUTCFullYear();
    const month = input.attentionDate.getUTCMonth() + 1;
    const range = {
      OR: [{ minimumAge: null }, { minimumAge: { lte: input.age } }],
      AND: { OR: [{ maximumAge: null }, { maximumAge: { gte: input.age } }] },
    };
    const [
      facility,
      program,
      week,
      period,
      ageGroup,
      comparativeAgeGroup,
      populationType,
      diseases,
    ] = await Promise.all([
      this.prisma.client.healthFacility.findFirst({
        where: { id: input.facilityId, active: true },
        select: { id: true, municipalityId: true, municipality: { select: { regionId: true } } },
      }),
      this.prisma.client.healthProgram.findFirst({
        where: { code: 'ITS', active: true },
        select: { id: true },
      }),
      this.prisma.client.epidemiologicalWeek.findFirst({
        where: {
          active: true,
          startDate: { lte: input.attentionDate },
          endDate: { gte: input.attentionDate },
        },
        select: { id: true },
      }),
      this.prisma.client.reportingPeriod.findFirst({
        where: {
          type: 'MENSUAL',
          year,
          month,
          status: 'ABIERTO',
          startDate: { lte: input.attentionDate },
          endDate: { gte: input.attentionDate },
        },
        select: { id: true },
      }),
      this.prisma.client.ageGroup.findFirst({
        where: { active: true, ...range },
        orderBy: { formatOrder: 'asc' },
        select: { id: true },
      }),
      this.prisma.client.comparativeAgeGroup.findFirst({
        where: { active: true, ...range },
        select: { id: true },
      }),
      this.prisma.client.populationType.findFirst({
        where: { id: input.populationTypeId, active: true },
        select: { id: true },
      }),
      this.prisma.client.itsDisease.findMany({
        where: {
          id: { in: [...new Set(input.diseaseIds)] },
          active: true,
          classification: { active: true, program: { code: 'ITS', active: true } },
        },
        select: { id: true, appliesToMale: true, appliesToFemale: true },
      }),
    ]);
    return {
      facility: facility
        ? {
            id: facility.id,
            municipalityId: facility.municipalityId,
            regionId: facility.municipality.regionId,
          }
        : undefined,
      programId: program?.id,
      epidemiologicalWeekId: week?.id,
      monthlyPeriodId: period?.id,
      ageGroupId: ageGroup?.id,
      comparativeAgeGroupId: comparativeAgeGroup?.id,
      populationTypeValid: Boolean(populationType),
      diseases,
    };
  }

  hasPossibleDuplicate(input: {
    facilityId: string;
    attentionDate: Date;
    patientRecordNumber: string;
  }): Promise<boolean> {
    return this.prisma.client.itsAttention
      .count({
        where: {
          facilityId: input.facilityId,
          attentionDate: input.attentionDate,
          patientRecordNumber: input.patientRecordNumber,
          status: 'ACTIVO',
        },
      })
      .then((count) => count > 0);
  }

  async create(input: PersistAttentionInput): Promise<CreatedAttention> {
    return this.prisma.client.$transaction(async (transaction) => {
      const attention = await transaction.itsAttention.create({
        data: {
          programId: input.programId,
          attentionDate: input.attentionDate,
          epidemiologicalWeekId: input.epidemiologicalWeekId,
          monthlyPeriodId: input.monthlyPeriodId,
          year: input.attentionDate.getUTCFullYear(),
          month: input.attentionDate.getUTCMonth() + 1,
          regionId: input.regionId,
          municipalityId: input.municipalityId,
          facilityId: input.facilityId,
          registeredById: input.userId,
          patientRecordNumber: input.patientRecordNumber,
          originText: input.originText,
          sex: input.sex,
          age: input.age,
          ageGroupId: input.ageGroupId,
          comparativeAgeGroupId: input.comparativeAgeGroupId,
          populationTypeId: input.populationTypeId,
          isContact: input.isContact,
          isPregnant: input.isPregnant,
          observation: input.observation,
          possibleDuplicate: input.possibleDuplicate,
          diagnoses: {
            create: input.diagnoses.map((item) => ({
              diseaseId: item.diseaseId,
              caseType: item.caseType,
            })),
          },
        },
        select: { id: true, possibleDuplicate: true, createdAt: true },
      });
      await transaction.auditEvent.create({
        data: {
          actorUserId: input.userId,
          action: 'ITS1_ATENCION_CREADA',
          entity: 'atenciones_its',
          entityId: attention.id,
          dataLevel: 'INDIVIDUAL',
          requestId: input.requestId,
          newData: {
            facilityId: input.facilityId,
            attentionDate: input.attentionDate.toISOString().slice(0, 10),
            possibleDuplicate: input.possibleDuplicate,
          },
        },
      });
      return attention;
    });
  }
}
