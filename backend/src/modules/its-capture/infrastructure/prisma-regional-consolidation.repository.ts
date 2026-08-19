import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { RegionalConsolidationRepository } from '../application/ports/regional-consolidation.repository';
import { aggregateReportDetails } from '../domain/aggregate-report-details';
import {
  RegionalConsolidationError,
  RegionalConsolidationNotFoundError,
  type RegionalConsolidationContext,
  type RegionalConsolidationSummary,
} from '../domain/regional-consolidation';

const regionalSelection = {
  id: true,
  status: true,
  version: true,
  sourceAttentionCount: true,
  attentionTotalsComplete: true,
  attentionsUnder15: true,
  attentions15Plus: true,
  currentComment: true,
  generatedAt: true,
  sentAt: true,
  approvedAt: true,
  region: {
    select: {
      id: true,
      code: true,
      name: true,
      _count: { select: { municipalities: { where: { active: true } } } },
    },
  },
  period: { select: { year: true, month: true } },
  consolidatedSources: {
    orderBy: { sourceReport: { municipality: { officialCode: 'asc' as const } } },
    select: {
      sourceVersion: true,
      sourceReport: {
        select: {
          id: true,
          municipality: { select: { id: true, officialCode: true, name: true } },
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

type RegionalRecord = {
  id: string;
  status: string;
  version: number;
  sourceAttentionCount: number;
  attentionTotalsComplete: boolean;
  attentionsUnder15: number | null;
  attentions15Plus: number | null;
  currentComment: string | null;
  generatedAt: Date;
  sentAt: Date | null;
  approvedAt: Date | null;
  region: { id: string; code: string; name: string; _count: { municipalities: number } } | null;
  period: { year: number; month: number | null };
  consolidatedSources: {
    sourceVersion: number;
    sourceReport: {
      id: string;
      municipality: { id: string; officialCode: string; name: string } | null;
    };
  }[];
  observations: { id: string; comment: string; createdAt: Date }[];
};

@Injectable()
export class PrismaRegionalConsolidationRepository extends RegionalConsolidationRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async getContext(regionIds?: readonly string[]): Promise<RegionalConsolidationContext> {
    if (regionIds && !regionIds.length) return { regions: [] };
    const regions = await this.prisma.client.region.findMany({
      where: { active: true, ...(regionIds ? { id: { in: [...regionIds] } } : {}) },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        _count: { select: { municipalities: { where: { active: true } } } },
      },
    });
    return {
      regions: regions.map((region) => ({
        id: region.id,
        code: region.code,
        name: region.name,
        activeMunicipalities: region._count.municipalities,
      })),
    };
  }

  async prepare(input: {
    regionId: string;
    year: number;
    month: number;
    userId: string;
    comment?: string;
  }): Promise<RegionalConsolidationSummary> {
    return this.prisma.client.$transaction(
      async (transaction) => {
        const [program, period, region] = await Promise.all([
          transaction.healthProgram.findFirst({
            where: { code: 'ITS', active: true },
            select: { id: true },
          }),
          transaction.reportingPeriod.findFirst({
            where: { type: 'MENSUAL', year: input.year, month: input.month },
            select: { id: true, status: true },
          }),
          transaction.region.findFirst({
            where: { id: input.regionId, active: true },
            select: {
              id: true,
              _count: { select: { municipalities: { where: { active: true } } } },
            },
          }),
        ]);
        if (!program || !period || !region)
          throw new RegionalConsolidationError(
            'No existe la configuración activa para preparar el consolidado regional.',
          );
        if (period.status !== 'ABIERTO')
          throw new RegionalConsolidationError('El período mensual debe estar abierto.');
        if (!region._count.municipalities)
          throw new RegionalConsolidationError(
            'La región no tiene municipios activos configurados.',
          );

        const [sources, current] = await Promise.all([
          transaction.itsReport.findMany({
            where: {
              periodId: period.id,
              regionId: region.id,
              level: 'MUNICIPAL',
              status: 'APROBADO_REGION',
              isCurrentVersion: true,
              municipality: { active: true },
            },
            orderBy: { municipalityId: 'asc' },
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
              regionId: region.id,
              level: 'REGIONAL',
              isCurrentVersion: true,
            },
            select: {
              id: true,
              status: true,
              version: true,
              consolidatedSources: { select: { sourceReportId: true, sourceVersion: true } },
            },
          }),
        ]);
        if (sources.length !== region._count.municipalities)
          throw new RegionalConsolidationError(
            `Faltan ${region._count.municipalities - sources.length} consolidado(s) municipal(es) aprobados.`,
          );
        if (current && current.status !== 'BORRADOR' && current.status !== 'DEVUELTO_POR_CENTRAL')
          throw new RegionalConsolidationError(
            'El consolidado enviado o aprobado ya no puede recalcularse.',
          );

        const signature = sources
          .map((source) => `${source.id}:${source.version}`)
          .sort()
          .join('|');
        const currentSignature = current?.consolidatedSources
          .map((source) => `${source.sourceReportId}:${source.sourceVersion}`)
          .sort()
          .join('|');
        if (current?.status === 'BORRADOR' && signature === currentSignature)
          return this.findSelected(transaction, current.id);

        const totalsComplete = sources.every((source) => source.attentionTotalsComplete);
        const commonData = {
          generatedById: input.userId,
          generatedAt: new Date(),
          currentComment: input.comment?.trim() || null,
          sourceAttentionCount: sources.reduce(
            (sum, source) => sum + source.sourceAttentionCount,
            0,
          ),
          attentionTotalsComplete: totalsComplete,
          attentionsUnder15: totalsComplete
            ? sources.reduce((sum, source) => sum + (source.attentionsUnder15 ?? 0), 0)
            : null,
          attentions15Plus: totalsComplete
            ? sources.reduce((sum, source) => sum + (source.attentions15Plus ?? 0), 0)
            : null,
          attentionTotalsSource: totalsComplete
            ? 'Consolidado de fuentes declaradas por municipios.'
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
              level: 'REGIONAL',
              regionId: region.id,
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
                'Consolidado regional preparado desde municipios aprobados.',
            },
          });
        }

        const details = aggregateReportDetails(sources.map((source) => source.details));
        if (details.length)
          await transaction.itsReportDetail.createMany({
            data: details.map((detail) => ({ reportId, ...detail })),
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
            action: 'ITS2_CONSOLIDADO_REGIONAL_PREPARADO',
            entity: 'reportes_its',
            entityId: reportId,
            dataLevel: 'AGREGADO',
            newData: {
              version,
              regionId: region.id,
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

  async findRegionId(reportId: string): Promise<string | undefined> {
    const report = await this.prisma.client.itsReport.findFirst({
      where: { id: reportId, level: 'REGIONAL' },
      select: { regionId: true },
    });
    return report?.regionId ?? undefined;
  }

  submitToCentral(
    reportId: string,
    userId: string,
    comment?: string,
  ): Promise<RegionalConsolidationSummary> {
    return this.transition(reportId, userId, 'BORRADOR', 'ENVIADO_A_CENTRAL', comment);
  }
  returnToRegion(
    reportId: string,
    userId: string,
    comment: string,
  ): Promise<RegionalConsolidationSummary> {
    if (!comment.trim())
      throw new RegionalConsolidationError('Debe indicar el motivo de devolución.');
    return this.transition(reportId, userId, 'ENVIADO_A_CENTRAL', 'DEVUELTO_POR_CENTRAL', comment);
  }
  approveCentrally(
    reportId: string,
    userId: string,
    comment?: string,
  ): Promise<RegionalConsolidationSummary> {
    return this.transition(reportId, userId, 'ENVIADO_A_CENTRAL', 'APROBADO_CENTRAL', comment);
  }

  async getCurrent(input: {
    regionId: string;
    year: number;
    month: number;
  }): Promise<RegionalConsolidationSummary | undefined> {
    const report = await this.prisma.client.itsReport.findFirst({
      where: {
        regionId: input.regionId,
        level: 'REGIONAL',
        isCurrentVersion: true,
        period: { type: 'MENSUAL', year: input.year, month: input.month },
      },
      select: regionalSelection,
    });
    return report ? this.mapReport(report) : undefined;
  }

  async listCentralInbox(input: {
    year: number;
    month: number;
  }): Promise<RegionalConsolidationSummary[]> {
    const reports = await this.prisma.client.itsReport.findMany({
      where: {
        level: 'REGIONAL',
        isCurrentVersion: true,
        status: { in: ['ENVIADO_A_CENTRAL', 'DEVUELTO_POR_CENTRAL', 'APROBADO_CENTRAL'] },
        period: { type: 'MENSUAL', year: input.year, month: input.month },
      },
      orderBy: [{ status: 'asc' }, { sentAt: 'asc' }],
      select: regionalSelection,
    });
    return reports.map((report) => this.mapReport(report));
  }

  private async transition(
    reportId: string,
    userId: string,
    expected: 'BORRADOR' | 'ENVIADO_A_CENTRAL',
    next: 'ENVIADO_A_CENTRAL' | 'DEVUELTO_POR_CENTRAL' | 'APROBADO_CENTRAL',
    comment?: string,
  ): Promise<RegionalConsolidationSummary> {
    return this.prisma.client.$transaction(async (transaction) => {
      const current = await transaction.itsReport.findFirst({
        where: { id: reportId, level: 'REGIONAL' },
        select: {
          status: true,
          isCurrentVersion: true,
          regionId: true,
          period: { select: { status: true } },
          consolidatedSources: {
            select: {
              sourceReport: { select: { status: true, isCurrentVersion: true } },
            },
          },
        },
      });
      if (!current)
        throw new RegionalConsolidationNotFoundError('El consolidado regional no existe.');
      if (!current.isCurrentVersion || current.status !== expected)
        throw new RegionalConsolidationError(
          `La transición desde ${current.status} no está permitida.`,
        );
      if (current.period.status !== 'ABIERTO')
        throw new RegionalConsolidationError('El período mensual debe estar abierto.');
      if (next === 'ENVIADO_A_CENTRAL') {
        if (
          current.consolidatedSources.some(
            (source) =>
              !source.sourceReport.isCurrentVersion ||
              source.sourceReport.status !== 'APROBADO_REGION',
          )
        )
          throw new RegionalConsolidationError(
            'Una fuente cambió desde la preparación. Recalcule el consolidado antes de enviarlo.',
          );
        const expectedMunicipalities = await transaction.municipality.count({
          where: { regionId: current.regionId!, active: true },
        });
        if (current.consolidatedSources.length !== expectedMunicipalities)
          throw new RegionalConsolidationError(
            'La cobertura municipal cambió. Recalcule el consolidado antes de enviarlo.',
          );
      }
      const now = new Date();
      const changed = await transaction.itsReport.updateMany({
        where: { id: reportId, level: 'REGIONAL', status: expected, isCurrentVersion: true },
        data: {
          status: next,
          currentComment: comment?.trim() || null,
          ...(next === 'ENVIADO_A_CENTRAL' ? { sentById: userId, sentAt: now } : {}),
          ...(next === 'APROBADO_CENTRAL' ? { approvedById: userId, approvedAt: now } : {}),
        },
      });
      if (changed.count !== 1)
        throw new RegionalConsolidationError('El consolidado cambió durante la transición.');
      await transaction.reportFlowHistory.create({
        data: {
          reportId,
          previousStatus: expected,
          newStatus: next,
          userId,
          comment: comment?.trim() || null,
        },
      });
      if (next === 'DEVUELTO_POR_CENTRAL')
        await transaction.reportObservation.create({
          data: { reportId, userId, originLevel: 'NACIONAL', comment: comment!.trim() },
        });
      await transaction.auditEvent.create({
        data: {
          actorUserId: userId,
          action: `ITS2_CONSOLIDADO_REGIONAL_${next}`,
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
  ): Promise<RegionalConsolidationSummary> {
    const report = await client.itsReport.findUnique({
      where: { id: reportId },
      select: regionalSelection,
    });
    if (!report) throw new RegionalConsolidationNotFoundError('El consolidado regional no existe.');
    return this.mapReport(report);
  }

  private mapReport(report: RegionalRecord): RegionalConsolidationSummary {
    if (!report.region || report.period.month === null)
      throw new RegionalConsolidationError(
        'El consolidado regional no tiene territorio o período válido.',
      );
    const sourceReports = report.consolidatedSources.map((source) => {
      if (!source.sourceReport.municipality)
        throw new RegionalConsolidationError('Una fuente regional no pertenece a un municipio.');
      return {
        id: source.sourceReport.id,
        version: source.sourceVersion,
        municipality: {
          id: source.sourceReport.municipality.id,
          code: source.sourceReport.municipality.officialCode,
          name: source.sourceReport.municipality.name,
        },
      };
    });
    return {
      id: report.id,
      status: report.status as RegionalConsolidationSummary['status'],
      version: report.version,
      region: { id: report.region.id, code: report.region.code, name: report.region.name },
      year: report.period.year,
      month: report.period.month,
      expectedMunicipalities: report.region._count.municipalities,
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
