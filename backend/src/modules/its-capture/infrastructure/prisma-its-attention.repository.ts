import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ItsAttentionRepository } from '../application/ports/its-attention.repository';
import {
  AttentionNotEditableError,
  AttentionNotFoundError,
  ConcurrentAttentionUpdateError,
} from '../domain/its-attention';
import type {
  CaptureContext,
  CaptureReferences,
  CreatedAttention,
  AttentionCursor,
  AttentionRecord,
  CancelAttentionInput,
  CancelledAttention,
  PersistAttentionInput,
  PersistAttentionUpdateInput,
} from '../domain/its-attention';
import type { MonthlyReportSource } from '../domain/its-monthly-report';
import type { Its1PrintRegister } from '../domain/its1-print-register';

@Injectable()
export class PrismaItsAttentionRepository extends ItsAttentionRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async getCaptureContext(facilityIds: readonly string[]): Promise<CaptureContext> {
    const [facilities, populationTypes, classifications] = await Promise.all([
      this.prisma.client.healthFacility.findMany({
        where: { id: { in: [...facilityIds] }, active: true },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          municipality: {
            select: {
              id: true,
              officialCode: true,
              name: true,
              region: { select: { id: true, code: true, name: true } },
            },
          },
        },
      }),
      this.prisma.client.populationType.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
        select: { id: true, code: true, name: true },
      }),
      this.prisma.client.itsClassification.findMany({
        where: { active: true, program: { code: 'ITS', active: true } },
        orderBy: { order: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          diseases: {
            where: { active: true },
            orderBy: { formatOrder: 'asc' },
            select: {
              id: true,
              code: true,
              name: true,
              appliesToMale: true,
              appliesToFemale: true,
            },
          },
        },
      }),
    ]);
    return {
      facilities: facilities.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        type: item.type,
        municipality: {
          id: item.municipality.id,
          code: item.municipality.officialCode,
          name: item.municipality.name,
        },
        region: item.municipality.region,
      })),
      populationTypes,
      classifications: classifications.map((item) => ({
        ...item,
        diseases: item.diseases.map((disease) => ({
          ...disease,
          code: disease.code ?? undefined,
        })),
      })),
    };
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
    excludeAttentionId?: string;
  }): Promise<boolean> {
    return this.prisma.client.itsAttention
      .count({
        where: {
          facilityId: input.facilityId,
          attentionDate: input.attentionDate,
          patientRecordNumber: input.patientRecordNumber,
          status: 'ACTIVO',
          ...(input.excludeAttentionId ? { id: { not: input.excludeAttentionId } } : {}),
        },
      })
      .then((count) => count > 0);
  }

  async list(input: {
    facilityId: string;
    year: number;
    month: number;
    limit: number;
    cursor?: AttentionCursor;
  }): Promise<readonly AttentionRecord[]> {
    const rows = await this.prisma.client.itsAttention.findMany({
      where: {
        facilityId: input.facilityId,
        year: input.year,
        month: input.month,
        status: 'ACTIVO',
        ...(input.cursor
          ? {
              OR: [
                { attentionDate: { lt: input.cursor.attentionDate } },
                { attentionDate: input.cursor.attentionDate, id: { lt: input.cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ attentionDate: 'desc' }, { id: 'desc' }],
      take: input.limit,
      select: this.attentionRecordSelection,
    });
    return rows.map((row) => this.toAttentionRecord(row));
  }

  async update(input: PersistAttentionUpdateInput): Promise<AttentionRecord> {
    try {
      return await this.prisma.client.$transaction(
        async (transaction) => {
          const existing = await transaction.itsAttention.findFirst({
            where: { id: input.id, facilityId: input.facilityId, status: 'ACTIVO' },
            select: {
              updatedAt: true,
              attentionDate: true,
              possibleDuplicate: true,
              monthlyPeriodId: true,
              monthlyPeriod: { select: { status: true } },
            },
          });
          if (!existing) throw new AttentionNotFoundError('La atención ITS-1 no existe.');
          if (existing.monthlyPeriod.status !== 'ABIERTO')
            throw new AttentionNotEditableError('La atención pertenece a un período no editable.');
          if (existing.updatedAt.getTime() !== input.expectedUpdatedAt.getTime())
            throw new ConcurrentAttentionUpdateError(
              'La atención fue modificada por otra persona. Recargue los datos antes de continuar.',
            );

          const affectedPeriodIds = [...new Set([existing.monthlyPeriodId, input.monthlyPeriodId])];
          const currentReports = await transaction.itsReport.findMany({
            where: {
              facilityId: input.facilityId,
              periodId: { in: affectedPeriodIds },
              type: 'ITS2_MENSUAL',
              level: 'ESTABLECIMIENTO',
              isCurrentVersion: true,
            },
            select: { id: true, status: true },
          });
          if (
            currentReports.some(
              (report) => !['BORRADOR', 'DEVUELTO_POR_MUNICIPIO'].includes(report.status),
            )
          )
            throw new AttentionNotEditableError(
              'La atención forma parte de un reporte enviado o aprobado y ya no puede corregirse.',
            );
          if (currentReports.length)
            await transaction.itsReport.updateMany({
              where: { id: { in: currentReports.map((report) => report.id) } },
              data: { isCurrentVersion: false },
            });

          // Remove the old diagnosis set inside the same serializable transaction before a
          // possible sex change. The database then validates every replacement diagnosis
          // against the new sex as it is inserted; any failure rolls the whole correction back.
          await transaction.attentionDiagnosis.deleteMany({ where: { attentionId: input.id } });

          const updated = await transaction.itsAttention.updateMany({
            where: {
              id: input.id,
              facilityId: input.facilityId,
              status: 'ACTIVO',
              updatedAt: input.expectedUpdatedAt,
            },
            data: {
              programId: input.programId,
              attentionDate: input.attentionDate,
              epidemiologicalWeekId: input.epidemiologicalWeekId,
              monthlyPeriodId: input.monthlyPeriodId,
              year: input.attentionDate.getUTCFullYear(),
              month: input.attentionDate.getUTCMonth() + 1,
              regionId: input.regionId,
              municipalityId: input.municipalityId,
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
            },
          });
          if (updated.count !== 1)
            throw new ConcurrentAttentionUpdateError(
              'La atención fue modificada por otra persona. Recargue los datos antes de continuar.',
            );

          await transaction.attentionDiagnosis.createMany({
            data: input.diagnoses.map((diagnosis) => ({
              attentionId: input.id,
              diseaseId: diagnosis.diseaseId,
              caseType: diagnosis.caseType,
            })),
          });
          await transaction.auditEvent.create({
            data: {
              actorUserId: input.userId,
              action: 'ITS1_ATENCION_ACTUALIZADA',
              entity: 'atenciones_its',
              entityId: input.id,
              dataLevel: 'INDIVIDUAL',
              requestId: input.requestId,
              previousData: {
                attentionDate: existing.attentionDate.toISOString().slice(0, 10),
                possibleDuplicate: existing.possibleDuplicate,
                updatedAt: existing.updatedAt.toISOString(),
              },
              newData: {
                attentionDate: input.attentionDate.toISOString().slice(0, 10),
                possibleDuplicate: input.possibleDuplicate,
                diagnosesCount: input.diagnoses.length,
              },
            },
          });
          const result = await transaction.itsAttention.findUniqueOrThrow({
            where: { id: input.id },
            select: this.attentionRecordSelection,
          });
          return this.toAttentionRecord(result);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error: unknown) {
      this.rethrowConcurrency(error);
    }
  }

  async cancel(input: CancelAttentionInput): Promise<CancelledAttention> {
    try {
      return await this.prisma.client.$transaction(
        async (transaction) => {
          const existing = await transaction.itsAttention.findFirst({
            where: { id: input.id, facilityId: input.facilityId, status: 'ACTIVO' },
            select: {
              id: true,
              attentionDate: true,
              updatedAt: true,
              monthlyPeriodId: true,
              monthlyPeriod: { select: { status: true } },
            },
          });
          if (!existing) throw new AttentionNotFoundError('La atención ITS-1 no existe.');
          if (existing.monthlyPeriod.status !== 'ABIERTO')
            throw new AttentionNotEditableError('La atención pertenece a un período no editable.');
          if (existing.updatedAt.getTime() !== input.expectedUpdatedAt.getTime())
            throw new ConcurrentAttentionUpdateError(
              'La atención fue modificada por otra persona. Recargue los datos antes de continuar.',
            );

          const currentReport = await transaction.itsReport.findFirst({
            where: {
              facilityId: input.facilityId,
              periodId: existing.monthlyPeriodId,
              type: 'ITS2_MENSUAL',
              level: 'ESTABLECIMIENTO',
              isCurrentVersion: true,
            },
            select: { id: true, status: true, version: true },
          });
          if (
            currentReport &&
            !['BORRADOR', 'DEVUELTO_POR_MUNICIPIO'].includes(currentReport.status)
          )
            throw new AttentionNotEditableError(
              'La atención forma parte de un reporte enviado o aprobado y ya no puede anularse.',
            );

          const cancelledAt = new Date();
          const updated = await transaction.itsAttention.updateMany({
            where: {
              id: input.id,
              facilityId: input.facilityId,
              status: 'ACTIVO',
              updatedAt: input.expectedUpdatedAt,
            },
            data: { status: 'ANULADO', updatedAt: cancelledAt },
          });
          if (updated.count !== 1)
            throw new ConcurrentAttentionUpdateError(
              'La atención fue modificada por otra persona. Recargue los datos antes de continuar.',
            );
          if (currentReport)
            await transaction.itsReport.update({
              where: { id: currentReport.id },
              data: { isCurrentVersion: false },
            });
          await transaction.auditEvent.create({
            data: {
              actorUserId: input.userId,
              action: 'ITS1_ATENCION_ANULADA',
              entity: 'atenciones_its',
              entityId: input.id,
              dataLevel: 'INDIVIDUAL',
              requestId: input.requestId,
              previousData: {
                status: 'ACTIVO',
                attentionDate: existing.attentionDate.toISOString().slice(0, 10),
                updatedAt: existing.updatedAt.toISOString(),
                invalidatedReportVersion: currentReport?.version,
              },
              newData: { status: 'ANULADO', updatedAt: cancelledAt.toISOString() },
              reason: input.reason,
            },
          });
          return { id: input.id, status: 'ANULADO', updatedAt: cancelledAt };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error: unknown) {
      this.rethrowConcurrency(error);
    }
  }

  async create(input: PersistAttentionInput): Promise<CreatedAttention> {
    try {
      return await this.prisma.client.$transaction(
        async (transaction) => {
          const currentReport = await transaction.itsReport.findFirst({
            where: {
              facilityId: input.facilityId,
              periodId: input.monthlyPeriodId,
              type: 'ITS2_MENSUAL',
              level: 'ESTABLECIMIENTO',
              isCurrentVersion: true,
            },
            select: { id: true, status: true },
          });
          if (
            currentReport &&
            !['BORRADOR', 'DEVUELTO_POR_MUNICIPIO'].includes(currentReport.status)
          )
            throw new AttentionNotEditableError(
              'El período ya forma parte de un reporte enviado o aprobado y no admite nuevas atenciones.',
            );
          if (currentReport)
            await transaction.itsReport.update({
              where: { id: currentReport.id },
              data: { isCurrentVersion: false },
            });

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
            select: { id: true, possibleDuplicate: true, createdAt: true, updatedAt: true },
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
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error: unknown) {
      this.rethrowConcurrency(error);
    }
  }

  async getMonthlyReportSource(input: {
    facilityId: string;
    year: number;
    month: number;
  }): Promise<MonthlyReportSource> {
    const [facility, ageGroups, diseases, attentions] = await Promise.all([
      this.prisma.client.healthFacility.findUniqueOrThrow({
        where: { id: input.facilityId },
        select: {
          id: true,
          code: true,
          name: true,
          municipality: {
            select: { name: true, region: { select: { name: true } } },
          },
        },
      }),
      this.prisma.client.ageGroup.findMany({
        where: { active: true },
        orderBy: { formatOrder: 'asc' },
        select: { code: true, name: true, formatOrder: true },
      }),
      this.prisma.client.itsDisease.findMany({
        where: { active: true, classification: { active: true, program: { code: 'ITS' } } },
        orderBy: { formatOrder: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          appliesToMale: true,
          appliesToFemale: true,
          formatOrder: true,
          classification: { select: { code: true, name: true } },
        },
      }),
      this.prisma.client.itsAttention.findMany({
        where: {
          facilityId: input.facilityId,
          year: input.year,
          month: input.month,
          status: 'ACTIVO',
        },
        select: {
          sex: true,
          age: true,
          isContact: true,
          isPregnant: true,
          ageGroup: { select: { code: true } },
          populationType: { select: { code: true } },
          diagnoses: { select: { diseaseId: true, caseType: true } },
        },
      }),
    ]);
    return {
      facility: {
        id: facility.id,
        code: facility.code,
        name: facility.name,
        municipalityName: facility.municipality.name,
        regionName: facility.municipality.region.name,
      },
      ageGroups,
      diseases: diseases.map((disease) => ({
        id: disease.id,
        code: disease.code ?? undefined,
        name: disease.name,
        classificationCode: disease.classification.code,
        classificationName: disease.classification.name,
        appliesToMale: disease.appliesToMale,
        appliesToFemale: disease.appliesToFemale,
        formatOrder: disease.formatOrder,
      })),
      attentions: attentions.map((attention) => ({
        sex: attention.sex,
        age: attention.age,
        ageGroupCode: attention.ageGroup.code,
        populationTypeCode: attention.populationType.code,
        isContact: attention.isContact,
        isPregnant: attention.isPregnant,
        diagnoses: attention.diagnoses,
      })),
    };
  }

  async getIts1PrintRegister(input: {
    facilityId: string;
    userId: string;
    year: number;
    month: number;
  }): Promise<Its1PrintRegister> {
    const [facility, responsible, diseases, attentions] = await Promise.all([
      this.prisma.client.healthFacility.findUniqueOrThrow({
        where: { id: input.facilityId },
        select: {
          id: true,
          code: true,
          name: true,
          municipality: { select: { name: true, region: { select: { name: true } } } },
        },
      }),
      this.prisma.client.appUser.findUniqueOrThrow({
        where: { id: input.userId },
        select: { fullName: true },
      }),
      this.prisma.client.itsDisease.findMany({
        where: { active: true, classification: { active: true, program: { code: 'ITS' } } },
        orderBy: { formatOrder: 'asc' },
        select: { id: true, code: true, name: true, formatOrder: true },
      }),
      this.prisma.client.itsAttention.findMany({
        where: {
          facilityId: input.facilityId,
          year: input.year,
          month: input.month,
          status: 'ACTIVO',
        },
        orderBy: [{ attentionDate: 'asc' }, { createdAt: 'asc' }],
        select: {
          originText: true,
          patientRecordNumber: true,
          sex: true,
          age: true,
          populationType: { select: { code: true } },
          isContact: true,
          isPregnant: true,
          diagnoses: {
            select: {
              diseaseId: true,
              caseType: true,
              disease: { select: { code: true, name: true } },
            },
          },
        },
      }),
    ]);
    return {
      facility: {
        id: facility.id,
        code: facility.code,
        name: facility.name,
        municipalityName: facility.municipality.name,
        regionName: facility.municipality.region.name,
      },
      responsibleName: responsible.fullName,
      year: input.year,
      month: input.month,
      diseases: diseases.map((disease) => ({
        ...disease,
        code: disease.code ?? undefined,
      })),
      attentions: attentions.map((attention) => ({
        ...attention,
        populationTypeCode: attention.populationType.code,
        diagnoses: attention.diagnoses.map((diagnosis) => ({
          diseaseId: diagnosis.diseaseId,
          diseaseCode: diagnosis.disease.code ?? undefined,
          diseaseName: diagnosis.disease.name,
          caseType: diagnosis.caseType,
        })),
      })),
    };
  }

  private readonly attentionRecordSelection = {
    id: true,
    facilityId: true,
    attentionDate: true,
    patientRecordNumber: true,
    originText: true,
    sex: true,
    age: true,
    populationType: { select: { id: true, code: true, name: true } },
    isContact: true,
    isPregnant: true,
    possibleDuplicate: true,
    observation: true,
    diagnoses: {
      orderBy: { createdAt: 'asc' as const },
      select: {
        diseaseId: true,
        caseType: true,
        disease: { select: { name: true } },
      },
    },
    createdAt: true,
    updatedAt: true,
  } as const;

  private toAttentionRecord(row: {
    id: string;
    facilityId: string;
    attentionDate: Date;
    patientRecordNumber: string;
    originText: string;
    sex: 'H' | 'M';
    age: number;
    populationType: { id: string; code: string; name: string };
    isContact: boolean;
    isPregnant: boolean;
    possibleDuplicate: boolean;
    observation: string | null;
    diagnoses: readonly {
      diseaseId: string;
      caseType: 'NUEVO' | 'CONTROL';
      disease: { name: string };
    }[];
    createdAt: Date;
    updatedAt: Date;
  }): AttentionRecord {
    return {
      ...row,
      observation: row.observation ?? undefined,
      diagnoses: row.diagnoses.map((diagnosis) => ({
        diseaseId: diagnosis.diseaseId,
        diseaseName: diagnosis.disease.name,
        caseType: diagnosis.caseType,
      })),
    };
  }

  private rethrowConcurrency(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')
      throw new ConcurrentAttentionUpdateError(
        'Otra operación modificó el registro o su reporte simultáneamente. Recargue e intente nuevamente.',
      );
    throw error;
  }
}
