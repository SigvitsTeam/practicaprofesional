import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { NationalConsolidationRepository } from '../application/ports/national-consolidation.repository';
import { aggregateReportDetails } from '../domain/aggregate-report-details';
import {
  NationalConsolidationError,
  NationalConsolidationNotFoundError,
  type NationalConsolidationContext,
  type NationalConsolidationSummary,
} from '../domain/national-consolidation';

const nationalSelection = {
  id: true,
  status: true,
  version: true,
  sourceAttentionCount: true,
  attentionTotalsComplete: true,
  attentionsUnder15: true,
  attentions15Plus: true,
  currentComment: true,
  generatedAt: true,
  closedAt: true,
  period: { select: { year: true, month: true, status: true } },
  consolidatedSources: {
    orderBy: { sourceReport: { region: { code: 'asc' as const } } },
    select: {
      sourceVersion: true,
      sourceReport: {
        select: { id: true, region: { select: { id: true, code: true, name: true } } },
      },
    },
  },
} as const;

type NationalRecord = {
  id: string;
  status: string;
  version: number;
  sourceAttentionCount: number;
  attentionTotalsComplete: boolean;
  attentionsUnder15: number | null;
  attentions15Plus: number | null;
  currentComment: string | null;
  generatedAt: Date;
  closedAt: Date | null;
  period: { year: number; month: number | null; status: 'ABIERTO' | 'CERRADO' | 'BLOQUEADO' };
  consolidatedSources: {
    sourceVersion: number;
    sourceReport: { id: string; region: { id: string; code: string; name: string } | null };
  }[];
};

@Injectable()
export class PrismaNationalConsolidationRepository extends NationalConsolidationRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async getContext(): Promise<NationalConsolidationContext> {
    return { activeRegions: await this.prisma.client.region.count({ where: { active: true } }) };
  }

  async prepare(input: {
    year: number;
    month: number;
    userId: string;
    comment?: string;
  }): Promise<NationalConsolidationSummary> {
    return this.prisma.client.$transaction(
      async (transaction) => {
        const [program, period, activeRegions] = await Promise.all([
          transaction.healthProgram.findFirst({
            where: { code: 'ITS', active: true },
            select: { id: true },
          }),
          transaction.reportingPeriod.findFirst({
            where: { type: 'MENSUAL', year: input.year, month: input.month },
            select: { id: true, status: true },
          }),
          transaction.region.count({ where: { active: true } }),
        ]);
        if (!program || !period)
          throw new NationalConsolidationError(
            'No existe configuración activa para el consolidado nacional.',
          );
        if (period.status !== 'ABIERTO')
          throw new NationalConsolidationError('El período mensual debe estar abierto.');
        if (!activeRegions)
          throw new NationalConsolidationError('No hay regiones activas configuradas.');

        const [sources, current] = await Promise.all([
          transaction.itsReport.findMany({
            where: {
              periodId: period.id,
              level: 'REGIONAL',
              status: 'APROBADO_CENTRAL',
              isCurrentVersion: true,
              region: { active: true },
            },
            orderBy: { regionId: 'asc' },
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
            where: { periodId: period.id, level: 'NACIONAL', isCurrentVersion: true },
            select: {
              id: true,
              status: true,
              version: true,
              consolidatedSources: { select: { sourceReportId: true, sourceVersion: true } },
            },
          }),
        ]);
        if (sources.length !== activeRegions)
          throw new NationalConsolidationError(
            `Faltan ${activeRegions - sources.length} consolidado(s) regional(es) aprobados.`,
          );
        if (current && current.status !== 'BORRADOR' && current.status !== 'REABIERTO_AUTORIZADO')
          throw new NationalConsolidationError(
            'El consolidado nacional actual no puede recalcularse.',
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
            ? 'Consolidado de fuentes declaradas por regiones.'
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
          if (current)
            await transaction.itsReport.update({
              where: { id: current.id },
              data: { isCurrentVersion: false },
            });
          version = (current?.version ?? 0) + 1;
          const created = await transaction.itsReport.create({
            data: {
              programId: program.id,
              periodId: period.id,
              type: 'ITS2_MENSUAL',
              level: 'NACIONAL',
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
                input.comment?.trim() || 'Consolidado nacional preparado desde regiones aprobadas.',
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
            action: 'ITS2_CONSOLIDADO_NACIONAL_PREPARADO',
            entity: 'reportes_its',
            entityId: reportId,
            dataLevel: 'AGREGADO',
            newData: {
              version,
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

  async getCurrent(input: {
    year: number;
    month: number;
  }): Promise<NationalConsolidationSummary | undefined> {
    const report = await this.prisma.client.itsReport.findFirst({
      where: {
        level: 'NACIONAL',
        isCurrentVersion: true,
        period: { type: 'MENSUAL', year: input.year, month: input.month },
      },
      select: nationalSelection,
    });
    return report ? this.mapReport(report, await this.activeRegionCount()) : undefined;
  }

  finalize(
    reportId: string,
    userId: string,
    comment?: string,
  ): Promise<NationalConsolidationSummary> {
    return this.transitionToNational(reportId, userId, comment);
  }

  async close(
    reportId: string,
    userId: string,
    reason: string,
  ): Promise<NationalConsolidationSummary> {
    if (reason.trim().length < 10)
      throw new NationalConsolidationError('Debe indicar un motivo de cierre válido.');
    return this.prisma.client.$transaction(async (transaction) => {
      const current = await transaction.itsReport.findFirst({
        where: { id: reportId, level: 'NACIONAL' },
        select: {
          status: true,
          isCurrentVersion: true,
          periodId: true,
          period: { select: { status: true } },
        },
      });
      if (!current)
        throw new NationalConsolidationNotFoundError('El consolidado nacional no existe.');
      if (
        !current.isCurrentVersion ||
        current.status !== 'CONSOLIDADO_NACIONAL' ||
        current.period.status !== 'ABIERTO'
      )
        throw new NationalConsolidationError('El consolidado no está listo para cierre oficial.');
      const now = new Date();
      const changed = await transaction.itsReport.updateMany({
        where: { id: reportId, status: 'CONSOLIDADO_NACIONAL', isCurrentVersion: true },
        data: {
          status: 'CERRADO_OFICIAL',
          closedById: userId,
          closedAt: now,
          currentComment: reason.trim(),
        },
      });
      if (changed.count !== 1)
        throw new NationalConsolidationError('El consolidado cambió durante el cierre.');
      await transaction.reportingPeriod.update({
        where: { id: current.periodId },
        data: { status: 'CERRADO' },
      });
      await this.recordTransition(
        transaction,
        reportId,
        userId,
        'CONSOLIDADO_NACIONAL',
        'CERRADO_OFICIAL',
        reason,
      );
      return this.findSelected(transaction, reportId);
    });
  }

  async reopen(
    reportId: string,
    userId: string,
    reason: string,
  ): Promise<NationalConsolidationSummary> {
    if (reason.trim().length < 10)
      throw new NationalConsolidationError('La reapertura requiere un motivo detallado.');
    return this.prisma.client.$transaction(async (transaction) => {
      const current = await transaction.itsReport.findFirst({
        where: { id: reportId, level: 'NACIONAL' },
        select: {
          status: true,
          isCurrentVersion: true,
          periodId: true,
          period: { select: { status: true } },
        },
      });
      if (!current)
        throw new NationalConsolidationNotFoundError('El consolidado nacional no existe.');
      if (
        !current.isCurrentVersion ||
        current.status !== 'CERRADO_OFICIAL' ||
        current.period.status !== 'CERRADO'
      )
        throw new NationalConsolidationError('Solo un cierre oficial vigente puede reabrirse.');
      const changed = await transaction.itsReport.updateMany({
        where: { id: reportId, status: 'CERRADO_OFICIAL', isCurrentVersion: true },
        data: { status: 'REABIERTO_AUTORIZADO', currentComment: reason.trim() },
      });
      if (changed.count !== 1)
        throw new NationalConsolidationError('El consolidado cambió durante la reapertura.');
      await transaction.reportingPeriod.update({
        where: { id: current.periodId },
        data: { status: 'ABIERTO' },
      });
      await this.recordTransition(
        transaction,
        reportId,
        userId,
        'CERRADO_OFICIAL',
        'REABIERTO_AUTORIZADO',
        reason,
      );
      return this.findSelected(transaction, reportId);
    });
  }

  private async transitionToNational(
    reportId: string,
    userId: string,
    comment?: string,
  ): Promise<NationalConsolidationSummary> {
    return this.prisma.client.$transaction(async (transaction) => {
      const current = await transaction.itsReport.findFirst({
        where: { id: reportId, level: 'NACIONAL' },
        select: {
          status: true,
          isCurrentVersion: true,
          period: { select: { status: true } },
          consolidatedSources: {
            select: {
              sourceReport: { select: { status: true, isCurrentVersion: true } },
            },
          },
        },
      });
      if (!current)
        throw new NationalConsolidationNotFoundError('El consolidado nacional no existe.');
      if (
        !current.isCurrentVersion ||
        current.status !== 'BORRADOR' ||
        current.period.status !== 'ABIERTO'
      )
        throw new NationalConsolidationError('El borrador nacional no puede finalizarse.');
      const expectedRegions = await transaction.region.count({ where: { active: true } });
      if (
        current.consolidatedSources.length !== expectedRegions ||
        current.consolidatedSources.some(
          (source) =>
            !source.sourceReport.isCurrentVersion ||
            source.sourceReport.status !== 'APROBADO_CENTRAL',
        )
      )
        throw new NationalConsolidationError(
          'Las fuentes regionales cambiaron. Recalcule antes de finalizar.',
        );
      const changed = await transaction.itsReport.updateMany({
        where: { id: reportId, status: 'BORRADOR', isCurrentVersion: true },
        data: { status: 'CONSOLIDADO_NACIONAL', currentComment: comment?.trim() || null },
      });
      if (changed.count !== 1)
        throw new NationalConsolidationError('El borrador cambió durante la finalización.');
      await this.recordTransition(
        transaction,
        reportId,
        userId,
        'BORRADOR',
        'CONSOLIDADO_NACIONAL',
        comment,
      );
      return this.findSelected(transaction, reportId);
    });
  }

  private async recordTransition(
    transaction: Parameters<Parameters<typeof this.prisma.client.$transaction>[0]>[0],
    reportId: string,
    userId: string,
    previous: 'BORRADOR' | 'CONSOLIDADO_NACIONAL' | 'CERRADO_OFICIAL',
    next: 'CONSOLIDADO_NACIONAL' | 'CERRADO_OFICIAL' | 'REABIERTO_AUTORIZADO',
    reason?: string,
  ): Promise<void> {
    await transaction.reportFlowHistory.create({
      data: {
        reportId,
        previousStatus: previous,
        newStatus: next,
        userId,
        comment: reason?.trim() || null,
      },
    });
    await transaction.auditEvent.create({
      data: {
        actorUserId: userId,
        action: `ITS2_NACIONAL_${next}`,
        entity: 'reportes_its',
        entityId: reportId,
        dataLevel: 'AGREGADO',
        previousData: { status: previous },
        newData: { status: next },
        reason: reason?.trim() || null,
      },
    });
  }

  private async activeRegionCount(): Promise<number> {
    return this.prisma.client.region.count({ where: { active: true } });
  }

  private async findSelected(
    client: Pick<typeof this.prisma.client, 'itsReport' | 'region'>,
    reportId: string,
  ): Promise<NationalConsolidationSummary> {
    const [report, expectedRegions] = await Promise.all([
      client.itsReport.findUnique({ where: { id: reportId }, select: nationalSelection }),
      client.region.count({ where: { active: true } }),
    ]);
    if (!report) throw new NationalConsolidationNotFoundError('El consolidado nacional no existe.');
    return this.mapReport(report, expectedRegions);
  }

  private mapReport(report: NationalRecord, expectedRegions: number): NationalConsolidationSummary {
    if (report.period.month === null)
      throw new NationalConsolidationError('El período nacional no es mensual.');
    const sourceReports = report.consolidatedSources.map((source) => {
      if (!source.sourceReport.region)
        throw new NationalConsolidationError('Una fuente nacional no pertenece a una región.');
      return {
        id: source.sourceReport.id,
        version: source.sourceVersion,
        region: source.sourceReport.region,
      };
    });
    return {
      id: report.id,
      status: report.status as NationalConsolidationSummary['status'],
      version: report.version,
      year: report.period.year,
      month: report.period.month,
      periodStatus: report.period.status,
      expectedRegions,
      sourceReports,
      sourceAttentionCount: report.sourceAttentionCount,
      attentionTotalsComplete: report.attentionTotalsComplete,
      attentionsUnder15: report.attentionsUnder15 ?? undefined,
      attentions15Plus: report.attentions15Plus ?? undefined,
      currentComment: report.currentComment ?? undefined,
      generatedAt: report.generatedAt,
      closedAt: report.closedAt ?? undefined,
    };
  }
}
