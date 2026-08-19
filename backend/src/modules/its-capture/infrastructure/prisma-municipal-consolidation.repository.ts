import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { MunicipalConsolidationRepository } from '../application/ports/municipal-consolidation.repository';
import {
  MunicipalConsolidationError,
  MunicipalConsolidationNotFoundError,
  type MunicipalConsolidationSummary,
  type MunicipalConsolidationContext,
  type MunicipalReportTerritory,
} from '../domain/municipal-consolidation';
import { aggregateReportDetails } from '../domain/aggregate-report-details';

const municipalSelection = {
  id: true,
  status: true,
  version: true,
  regionId: true,
  sourceAttentionCount: true,
  attentionTotalsComplete: true,
  attentionsUnder15: true,
  attentions15Plus: true,
  currentComment: true,
  generatedAt: true,
  sentAt: true,
  approvedAt: true,
  municipality: {
    select: {
      id: true,
      officialCode: true,
      name: true,
      _count: { select: { facilities: { where: { active: true } } } },
    },
  },
  period: { select: { year: true, month: true } },
  consolidatedSources: {
    orderBy: { sourceReport: { facility: { code: 'asc' as const } } },
    select: {
      sourceVersion: true,
      sourceReport: {
        select: {
          id: true,
          facility: { select: { id: true, code: true, name: true } },
        },
      },
    },
  },
  observations: {
    where: { status: 'ABIERTA' as const },
    orderBy: { createdAt: 'asc' as const },
    select: { id: true, comment: true, createdAt: true },
  },
} as const;

type MunicipalRecord = {
  id: string;
  status: string;
  version: number;
  regionId: string | null;
  sourceAttentionCount: number;
  attentionTotalsComplete: boolean;
  attentionsUnder15: number | null;
  attentions15Plus: number | null;
  currentComment: string | null;
  generatedAt: Date;
  sentAt: Date | null;
  approvedAt: Date | null;
  municipality: {
    id: string;
    officialCode: string;
    name: string;
    _count: { facilities: number };
  } | null;
  period: { year: number; month: number | null };
  consolidatedSources: {
    sourceVersion: number;
    sourceReport: {
      id: string;
      facility: { id: string; code: string; name: string } | null;
    };
  }[];
  observations: { id: string; comment: string; createdAt: Date }[];
};

@Injectable()
export class PrismaMunicipalConsolidationRepository extends MunicipalConsolidationRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async getContext(municipalityIds?: readonly string[]): Promise<MunicipalConsolidationContext> {
    if (municipalityIds && !municipalityIds.length) return { municipalities: [] };
    const municipalities = await this.prisma.client.municipality.findMany({
      where: {
        active: true,
        ...(municipalityIds ? { id: { in: [...municipalityIds] } } : {}),
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        officialCode: true,
        name: true,
        regionId: true,
        _count: { select: { facilities: { where: { active: true } } } },
      },
    });
    return {
      municipalities: municipalities.map((municipality) => ({
        id: municipality.id,
        code: municipality.officialCode,
        name: municipality.name,
        regionId: municipality.regionId,
        activeFacilities: municipality._count.facilities,
      })),
    };
  }

  async prepare(input: {
    municipalityId: string;
    year: number;
    month: number;
    userId: string;
    comment?: string;
  }): Promise<MunicipalConsolidationSummary> {
    return this.prisma.client.$transaction(
      async (transaction) => {
        const [program, period, municipality] = await Promise.all([
          transaction.healthProgram.findFirst({
            where: { code: 'ITS', active: true },
            select: { id: true },
          }),
          transaction.reportingPeriod.findFirst({
            where: { type: 'MENSUAL', year: input.year, month: input.month },
            select: { id: true, status: true },
          }),
          transaction.municipality.findFirst({
            where: { id: input.municipalityId, active: true },
            select: {
              id: true,
              regionId: true,
              _count: { select: { facilities: { where: { active: true } } } },
            },
          }),
        ]);
        if (!program || !period || !municipality)
          throw new MunicipalConsolidationError(
            'No existe la configuración activa para preparar el consolidado municipal.',
          );
        if (period.status !== 'ABIERTO')
          throw new MunicipalConsolidationError('El período mensual debe estar abierto.');
        if (municipality._count.facilities === 0)
          throw new MunicipalConsolidationError(
            'El municipio no tiene establecimientos activos configurados.',
          );

        const [sources, current] = await Promise.all([
          transaction.itsReport.findMany({
            where: {
              periodId: period.id,
              municipalityId: municipality.id,
              level: 'ESTABLECIMIENTO',
              status: 'APROBADO_MUNICIPIO',
              isCurrentVersion: true,
              facility: { active: true },
            },
            orderBy: { facilityId: 'asc' },
            select: {
              id: true,
              version: true,
              sourceAttentionCount: true,
              attentionTotalsComplete: true,
              attentionsUnder15: true,
              attentions15Plus: true,
              details: {
                select: {
                  diseaseId: true,
                  ageGroupId: true,
                  sex: true,
                  populationTypeId: true,
                  caseType: true,
                  isContact: true,
                  isPregnant: true,
                  total: true,
                },
              },
            },
          }),
          transaction.itsReport.findFirst({
            where: {
              periodId: period.id,
              municipalityId: municipality.id,
              level: 'MUNICIPAL',
              isCurrentVersion: true,
            },
            select: {
              id: true,
              status: true,
              version: true,
              consolidatedSources: {
                select: { sourceReportId: true, sourceVersion: true },
              },
            },
          }),
        ]);

        if (sources.length !== municipality._count.facilities) {
          const missing = municipality._count.facilities - sources.length;
          throw new MunicipalConsolidationError(
            `Faltan ${missing} reporte(s) de establecimiento aprobados para consolidar.`,
          );
        }
        if (current && current.status !== 'BORRADOR' && current.status !== 'DEVUELTO_POR_REGION')
          throw new MunicipalConsolidationError(
            'El consolidado enviado o aprobado ya no puede recalcularse.',
          );

        const sourceSignature = sources
          .map((source) => `${source.id}:${source.version}`)
          .sort()
          .join('|');
        const currentSignature = current?.consolidatedSources
          .map((source) => `${source.sourceReportId}:${source.sourceVersion}`)
          .sort()
          .join('|');
        if (current?.status === 'BORRADOR' && sourceSignature === currentSignature)
          return this.findSelected(transaction, current.id);

        const totalsComplete = sources.every((source) => source.attentionTotalsComplete);
        const commonData = {
          generatedById: input.userId,
          generatedAt: new Date(),
          currentComment: input.comment?.trim() || null,
          sourceAttentionCount: sources.reduce(
            (total, source) => total + source.sourceAttentionCount,
            0,
          ),
          attentionTotalsComplete: totalsComplete,
          attentionsUnder15: totalsComplete
            ? sources.reduce((total, source) => total + (source.attentionsUnder15 ?? 0), 0)
            : null,
          attentions15Plus: totalsComplete
            ? sources.reduce((total, source) => total + (source.attentions15Plus ?? 0), 0)
            : null,
          attentionTotalsSource: totalsComplete
            ? 'Consolidado de fuentes declaradas por establecimientos.'
            : null,
        };

        let reportId: string;
        let version: number;
        if (current?.status === 'BORRADOR') {
          await transaction.itsReport.update({ where: { id: current.id }, data: commonData });
          await Promise.all([
            transaction.itsReportDetail.deleteMany({ where: { reportId: current.id } }),
            transaction.reportSource.deleteMany({ where: { reportId: current.id } }),
          ]);
          reportId = current.id;
          version = current.version;
        } else {
          if (current) {
            await transaction.itsReport.update({
              where: { id: current.id },
              data: { isCurrentVersion: false },
            });
            await transaction.reportObservation.updateMany({
              where: { reportId: current.id, status: 'ABIERTA' },
              data: { status: 'RESUELTA' },
            });
          }
          version = (current?.version ?? 0) + 1;
          const created = await transaction.itsReport.create({
            data: {
              programId: program.id,
              periodId: period.id,
              type: 'ITS2_MENSUAL',
              level: 'MUNICIPAL',
              regionId: municipality.regionId,
              municipalityId: municipality.id,
              status: 'BORRADOR',
              version,
              ...commonData,
            },
            select: { id: true },
          });
          reportId = created.id;
          await transaction.reportFlowHistory.create({
            data: {
              reportId,
              previousStatus: current?.status,
              newStatus: 'BORRADOR',
              userId: input.userId,
              comment:
                input.comment?.trim() ||
                'Consolidado municipal preparado desde reportes aprobados.',
            },
          });
        }

        const grouped = aggregateReportDetails(sources.map((source) => source.details));
        if (grouped.length)
          await transaction.itsReportDetail.createMany({
            data: grouped.map((detail) => ({ reportId, ...detail })),
          });
        await transaction.reportSource.createMany({
          data: sources.map((source) => ({
            reportId,
            sourceReportId: source.id,
            sourceVersion: source.version,
          })),
        });
        await transaction.auditEvent.create({
          data: {
            actorUserId: input.userId,
            action: 'ITS2_CONSOLIDADO_MUNICIPAL_PREPARADO',
            entity: 'reportes_its',
            entityId: reportId,
            dataLevel: 'AGREGADO',
            newData: {
              version,
              municipalityId: municipality.id,
              sourceReportCount: sources.length,
              sourceAttentionCount: commonData.sourceAttentionCount,
            },
          },
        });
        return this.findSelected(transaction, reportId);
      },
      { isolationLevel: 'Serializable', timeout: 30_000 },
    );
  }

  async findTerritory(reportId: string): Promise<MunicipalReportTerritory | undefined> {
    const report = await this.prisma.client.itsReport.findFirst({
      where: { id: reportId, level: 'MUNICIPAL' },
      select: { municipalityId: true, regionId: true },
    });
    return report?.municipalityId && report.regionId
      ? { municipalityId: report.municipalityId, regionId: report.regionId }
      : undefined;
  }

  submitToRegion(
    reportId: string,
    userId: string,
    comment?: string,
  ): Promise<MunicipalConsolidationSummary> {
    return this.transition(reportId, userId, 'BORRADOR', 'ENVIADO_A_REGION', comment);
  }

  returnToMunicipality(
    reportId: string,
    userId: string,
    comment: string,
  ): Promise<MunicipalConsolidationSummary> {
    if (!comment.trim())
      throw new MunicipalConsolidationError('Debe indicar el motivo de devolución.');
    return this.transition(reportId, userId, 'ENVIADO_A_REGION', 'DEVUELTO_POR_REGION', comment);
  }

  approveRegionally(
    reportId: string,
    userId: string,
    comment?: string,
  ): Promise<MunicipalConsolidationSummary> {
    return this.transition(reportId, userId, 'ENVIADO_A_REGION', 'APROBADO_REGION', comment);
  }

  async getCurrent(input: {
    municipalityId: string;
    year: number;
    month: number;
  }): Promise<MunicipalConsolidationSummary | undefined> {
    const report = await this.prisma.client.itsReport.findFirst({
      where: {
        municipalityId: input.municipalityId,
        level: 'MUNICIPAL',
        isCurrentVersion: true,
        period: { type: 'MENSUAL', year: input.year, month: input.month },
      },
      select: municipalSelection,
    });
    return report ? this.mapReport(report) : undefined;
  }

  async listRegionalInbox(input: {
    regionIds?: readonly string[];
    year: number;
    month: number;
  }): Promise<MunicipalConsolidationSummary[]> {
    if (input.regionIds && !input.regionIds.length) return [];
    const reports = await this.prisma.client.itsReport.findMany({
      where: {
        ...(input.regionIds ? { regionId: { in: [...input.regionIds] } } : {}),
        level: 'MUNICIPAL',
        isCurrentVersion: true,
        status: { in: ['ENVIADO_A_REGION', 'DEVUELTO_POR_REGION', 'APROBADO_REGION'] },
        period: { type: 'MENSUAL', year: input.year, month: input.month },
      },
      orderBy: [{ status: 'asc' }, { sentAt: 'asc' }],
      select: municipalSelection,
    });
    return reports.map((report) => this.mapReport(report));
  }

  private async transition(
    reportId: string,
    userId: string,
    expected: 'BORRADOR' | 'ENVIADO_A_REGION',
    next: 'ENVIADO_A_REGION' | 'DEVUELTO_POR_REGION' | 'APROBADO_REGION',
    comment?: string,
  ): Promise<MunicipalConsolidationSummary> {
    return this.prisma.client.$transaction(async (transaction) => {
      const current = await transaction.itsReport.findFirst({
        where: { id: reportId, level: 'MUNICIPAL' },
        select: {
          status: true,
          isCurrentVersion: true,
          municipalityId: true,
          period: { select: { status: true } },
          consolidatedSources: {
            select: {
              sourceReport: {
                select: { status: true, isCurrentVersion: true },
              },
            },
          },
        },
      });
      if (!current)
        throw new MunicipalConsolidationNotFoundError('El consolidado municipal no existe.');
      if (!current.isCurrentVersion || current.status !== expected)
        throw new MunicipalConsolidationError(
          `La transición desde ${current.status} no está permitida.`,
        );
      if (current.period.status !== 'ABIERTO')
        throw new MunicipalConsolidationError('El período mensual debe estar abierto.');
      if (
        next === 'ENVIADO_A_REGION' &&
        current.consolidatedSources.some(
          (source) =>
            !source.sourceReport.isCurrentVersion ||
            source.sourceReport.status !== 'APROBADO_MUNICIPIO',
        )
      )
        throw new MunicipalConsolidationError(
          'Una fuente cambió desde la preparación. Recalcule el consolidado antes de enviarlo.',
        );
      if (next === 'ENVIADO_A_REGION') {
        const expectedFacilities = await transaction.healthFacility.count({
          where: { municipalityId: current.municipalityId!, active: true },
        });
        if (current.consolidatedSources.length !== expectedFacilities)
          throw new MunicipalConsolidationError(
            'La cobertura de establecimientos cambió. Recalcule el consolidado antes de enviarlo.',
          );
      }

      const now = new Date();
      const changed = await transaction.itsReport.updateMany({
        where: { id: reportId, level: 'MUNICIPAL', status: expected, isCurrentVersion: true },
        data: {
          status: next,
          currentComment: comment?.trim() || null,
          ...(next === 'ENVIADO_A_REGION' ? { sentById: userId, sentAt: now } : {}),
          ...(next === 'APROBADO_REGION' ? { approvedById: userId, approvedAt: now } : {}),
        },
      });
      if (changed.count !== 1)
        throw new MunicipalConsolidationError(
          'El consolidado cambió mientras se procesaba la transición.',
        );
      await transaction.reportFlowHistory.create({
        data: {
          reportId,
          previousStatus: expected,
          newStatus: next,
          userId,
          comment: comment?.trim() || null,
        },
      });
      if (next === 'DEVUELTO_POR_REGION')
        await transaction.reportObservation.create({
          data: {
            reportId,
            userId,
            originLevel: 'REGIONAL',
            comment: comment!.trim(),
          },
        });
      await transaction.auditEvent.create({
        data: {
          actorUserId: userId,
          action: `ITS2_CONSOLIDADO_MUNICIPAL_${next}`,
          entity: 'reportes_its',
          entityId: reportId,
          dataLevel: 'AGREGADO',
          previousData: { status: expected },
          newData: { status: next },
          reason: comment?.trim() || null,
        },
      });
      return this.findSelected(transaction, reportId);
    });
  }

  private async findSelected(
    client: Pick<typeof this.prisma.client, 'itsReport'>,
    reportId: string,
  ): Promise<MunicipalConsolidationSummary> {
    const report = await client.itsReport.findUnique({
      where: { id: reportId },
      select: municipalSelection,
    });
    if (!report)
      throw new MunicipalConsolidationNotFoundError('El consolidado municipal no existe.');
    return this.mapReport(report);
  }

  private mapReport(report: MunicipalRecord): MunicipalConsolidationSummary {
    if (!report.municipality || !report.regionId || report.period.month === null)
      throw new MunicipalConsolidationError(
        'El consolidado municipal no tiene territorio o período válido.',
      );
    const sourceReports = report.consolidatedSources.map((source) => {
      if (!source.sourceReport.facility)
        throw new MunicipalConsolidationError(
          'Una fuente del consolidado no pertenece a un establecimiento.',
        );
      return {
        id: source.sourceReport.id,
        version: source.sourceVersion,
        facility: source.sourceReport.facility,
      };
    });
    return {
      id: report.id,
      status: report.status as MunicipalConsolidationSummary['status'],
      version: report.version,
      municipality: {
        id: report.municipality.id,
        code: report.municipality.officialCode,
        name: report.municipality.name,
      },
      regionId: report.regionId,
      year: report.period.year,
      month: report.period.month,
      expectedFacilities: report.municipality._count.facilities,
      sourceReports,
      sourceAttentionCount: report.sourceAttentionCount,
      attentionTotalsComplete: report.attentionTotalsComplete,
      attentionsUnder15: report.attentionsUnder15 ?? undefined,
      attentions15Plus: report.attentions15Plus ?? undefined,
      currentComment: report.currentComment ?? undefined,
      generatedAt: report.generatedAt,
      sentAt: report.sentAt ?? undefined,
      approvedAt: report.approvedAt ?? undefined,
      openObservations: report.observations,
    };
  }
}
