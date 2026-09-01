import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ItsReportWorkflowRepository } from '../application/ports/its-report-workflow.repository';
import {
  ItsReportNotFoundError,
  ItsReportWorkflowError,
  type Its2ReportSummary,
  type PrepareIts2ReportInput,
  type ReportTerritory,
} from '../domain/its-report-workflow';

const reportSelection = {
  id: true,
  status: true,
  version: true,
  municipalityId: true,
  attentionsUnder15: true,
  attentions15Plus: true,
  attentionTotalsSource: true,
  attentionTotalsComplete: true,
  sourceAttentionCount: true,
  currentComment: true,
  generatedAt: true,
  sentAt: true,
  approvedAt: true,
  facility: { select: { id: true, code: true, name: true } },
  period: { select: { year: true, month: true } },
  observations: {
    where: { status: 'ABIERTA' as const },
    orderBy: { createdAt: 'asc' as const },
    select: { id: true, comment: true, createdAt: true },
  },
} as const;

type ReportRecord = {
  id: string;
  status: string;
  version: number;
  municipalityId: string | null;
  attentionsUnder15: number | null;
  attentions15Plus: number | null;
  attentionTotalsSource: string | null;
  attentionTotalsComplete: boolean;
  sourceAttentionCount: number;
  currentComment: string | null;
  generatedAt: Date;
  sentAt: Date | null;
  approvedAt: Date | null;
  facility: { id: string; code: string; name: string } | null;
  period: { year: number; month: number | null };
  observations: { id: string; comment: string; createdAt: Date }[];
};

@Injectable()
export class PrismaItsReportWorkflowRepository extends ItsReportWorkflowRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async prepare(input: PrepareIts2ReportInput): Promise<Its2ReportSummary> {
    return this.runWorkflowTransaction(async (transaction) => {
      const [program, period, facility, attentions] = await Promise.all([
        transaction.healthProgram.findFirst({
          where: { code: 'ITS', active: true },
          select: { id: true },
        }),
        transaction.reportingPeriod.findFirst({
          where: { type: 'MENSUAL', year: input.year, month: input.month },
          select: { id: true, status: true },
        }),
        transaction.healthFacility.findFirst({
          where: { id: input.facilityId, active: true },
          select: {
            id: true,
            municipalityId: true,
            municipality: { select: { regionId: true } },
          },
        }),
        transaction.itsAttention.findMany({
          where: {
            facilityId: input.facilityId,
            year: input.year,
            month: input.month,
            status: 'ACTIVO',
          },
          select: {
            ageGroupId: true,
            sex: true,
            populationTypeId: true,
            isContact: true,
            isPregnant: true,
            diagnoses: { select: { diseaseId: true, caseType: true } },
          },
        }),
      ]);
      if (!program || !period || !facility)
        throw new ItsReportWorkflowError('No existe la configuración activa para preparar ITS-2.');
      if (period.status !== 'ABIERTO')
        throw new ItsReportWorkflowError('El período mensual debe estar abierto.');

      const current = await transaction.itsReport.findFirst({
        where: {
          periodId: period.id,
          facilityId: facility.id,
          type: 'ITS2_MENSUAL',
          level: 'ESTABLECIMIENTO',
          isCurrentVersion: true,
        },
        select: { id: true, status: true, version: true },
      });
      if (current && current.status !== 'BORRADOR' && current.status !== 'DEVUELTO_POR_MUNICIPIO')
        throw new ItsReportWorkflowError('El reporte enviado o aprobado ya no puede recalcularse.');

      const totalsComplete =
        input.attentionsUnder15 !== undefined &&
        input.attentionsUnder15 >= 0 &&
        input.attentions15Plus !== undefined &&
        input.attentions15Plus >= 0 &&
        Boolean(input.attentionTotalsSource?.trim());
      const commonData = {
        generatedById: input.userId,
        generatedAt: new Date(),
        currentComment: input.comment?.trim() || null,
        attentionsUnder15: input.attentionsUnder15,
        attentions15Plus: input.attentions15Plus,
        attentionTotalsSource: input.attentionTotalsSource?.trim() || null,
        attentionTotalsComplete: totalsComplete,
        sourceAttentionCount: attentions.length,
      };

      let reportId: string;
      let version: number;
      if (current?.status === 'BORRADOR') {
        const changed = await transaction.itsReport.updateMany({
          where: { id: current.id, status: 'BORRADOR', isCurrentVersion: true },
          data: commonData,
        });
        if (changed.count !== 1)
          throw new ItsReportWorkflowError(
            'El reporte cambió mientras se preparaba. Recargue e intente nuevamente.',
          );
        await transaction.itsReportDetail.deleteMany({ where: { reportId: current.id } });
        reportId = current.id;
        version = current.version;
      } else {
        if (current) {
          const changed = await transaction.itsReport.updateMany({
            where: {
              id: current.id,
              status: 'DEVUELTO_POR_MUNICIPIO',
              isCurrentVersion: true,
            },
            data: { isCurrentVersion: false },
          });
          if (changed.count !== 1)
            throw new ItsReportWorkflowError(
              'El reporte cambió mientras se preparaba. Recargue e intente nuevamente.',
            );
          await transaction.reportObservation.updateMany({
            where: { reportId: current.id, status: 'ABIERTA' },
            data: { status: 'RESUELTA' },
          });
        }
        // ITS-1 corrections invalidate the current report. Historical versions
        // still reserve their number, even when no report is marked current.
        const latest = await transaction.itsReport.findFirst({
          where: { periodId: period.id, facilityId: facility.id },
          orderBy: { version: 'desc' },
          select: { version: true },
        });
        version = (latest?.version ?? 0) + 1;
        const created = await transaction.itsReport.create({
          data: {
            programId: program.id,
            periodId: period.id,
            type: 'ITS2_MENSUAL',
            level: 'ESTABLECIMIENTO',
            regionId: facility.municipality.regionId,
            municipalityId: facility.municipalityId,
            facilityId: facility.id,
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
            comment: input.comment?.trim() || 'Reporte ITS-2 preparado desde atenciones activas.',
          },
        });
      }

      const grouped = new Map<
        string,
        {
          diseaseId: string;
          ageGroupId: string;
          sex: 'H' | 'M';
          populationTypeId: string;
          caseType: 'NUEVO' | 'CONTROL';
          isContact: boolean;
          isPregnant: boolean;
          total: number;
        }
      >();
      for (const attention of attentions) {
        for (const diagnosis of attention.diagnoses) {
          const item = {
            diseaseId: diagnosis.diseaseId,
            ageGroupId: attention.ageGroupId,
            sex: attention.sex,
            populationTypeId: attention.populationTypeId,
            caseType: diagnosis.caseType,
            isContact: attention.isContact,
            isPregnant: attention.isPregnant,
          };
          const key = Object.values(item).join('|');
          const existing = grouped.get(key);
          grouped.set(key, { ...item, total: (existing?.total ?? 0) + 1 });
        }
      }
      if (grouped.size)
        await transaction.itsReportDetail.createMany({
          data: [...grouped.values()].map((detail) => ({ reportId, ...detail })),
        });

      await transaction.auditEvent.create({
        data: {
          actorUserId: input.userId,
          action: 'ITS2_REPORTE_PREPARADO',
          entity: 'reportes_its',
          entityId: reportId,
          dataLevel: 'AGREGADO',
          newData: {
            version,
            sourceAttentionCount: attentions.length,
            attentionTotalsComplete: totalsComplete,
          },
        },
      });
      return this.findSelected(transaction, reportId);
    });
  }

  async findTerritory(reportId: string): Promise<ReportTerritory | undefined> {
    const report = await this.prisma.client.itsReport.findUnique({
      where: { id: reportId },
      select: { facilityId: true, municipalityId: true },
    });
    return report
      ? {
          facilityId: report.facilityId ?? undefined,
          municipalityId: report.municipalityId ?? undefined,
        }
      : undefined;
  }

  submit(reportId: string, userId: string): Promise<Its2ReportSummary> {
    return this.transition(reportId, userId, 'BORRADOR', 'ENVIADO_A_MUNICIPIO');
  }

  returnToFacility(reportId: string, userId: string, comment: string): Promise<Its2ReportSummary> {
    if (!comment.trim()) throw new ItsReportWorkflowError('Debe indicar el motivo de devolución.');
    return this.transition(
      reportId,
      userId,
      'ENVIADO_A_MUNICIPIO',
      'DEVUELTO_POR_MUNICIPIO',
      comment,
    );
  }

  approveMunicipally(
    reportId: string,
    userId: string,
    comment?: string,
  ): Promise<Its2ReportSummary> {
    return this.transition(reportId, userId, 'ENVIADO_A_MUNICIPIO', 'APROBADO_MUNICIPIO', comment);
  }

  async getCurrent(input: {
    facilityId: string;
    year: number;
    month: number;
  }): Promise<Its2ReportSummary | undefined> {
    const report = await this.prisma.client.itsReport.findFirst({
      where: {
        facilityId: input.facilityId,
        isCurrentVersion: true,
        level: 'ESTABLECIMIENTO',
        period: { year: input.year, month: input.month, type: 'MENSUAL' },
      },
      select: reportSelection,
    });
    return report ? this.mapReport(report) : undefined;
  }

  async listMunicipalInbox(input: {
    municipalityIds: readonly string[];
    year: number;
    month: number;
  }): Promise<Its2ReportSummary[]> {
    if (!input.municipalityIds.length) return [];
    const reports = await this.prisma.client.itsReport.findMany({
      where: {
        municipalityId: { in: [...input.municipalityIds] },
        isCurrentVersion: true,
        level: 'ESTABLECIMIENTO',
        status: { in: ['ENVIADO_A_MUNICIPIO', 'DEVUELTO_POR_MUNICIPIO', 'APROBADO_MUNICIPIO'] },
        period: { year: input.year, month: input.month, type: 'MENSUAL' },
      },
      orderBy: [{ status: 'asc' }, { sentAt: 'asc' }],
      select: reportSelection,
    });
    return reports.map((report) => this.mapReport(report));
  }

  private async transition(
    reportId: string,
    userId: string,
    expected: 'BORRADOR' | 'ENVIADO_A_MUNICIPIO',
    next: 'ENVIADO_A_MUNICIPIO' | 'DEVUELTO_POR_MUNICIPIO' | 'APROBADO_MUNICIPIO',
    comment?: string,
  ): Promise<Its2ReportSummary> {
    return this.runWorkflowTransaction(async (transaction) => {
      const current = await transaction.itsReport.findUnique({
        where: { id: reportId },
        select: {
          status: true,
          isCurrentVersion: true,
          attentionTotalsComplete: true,
          period: { select: { status: true } },
        },
      });
      if (!current) throw new ItsReportNotFoundError('El reporte ITS-2 no existe.');
      if (!current.isCurrentVersion || current.status !== expected)
        throw new ItsReportWorkflowError(
          `La transición desde ${current.status} no está permitida.`,
        );
      if (current.period.status !== 'ABIERTO')
        throw new ItsReportWorkflowError('El período mensual debe estar abierto.');
      if (next === 'ENVIADO_A_MUNICIPIO' && !current.attentionTotalsComplete)
        throw new ItsReportWorkflowError(
          'Complete los totales de atenciones y su fuente antes de enviar.',
        );

      const now = new Date();
      const changed = await transaction.itsReport.updateMany({
        where: { id: reportId, status: expected, isCurrentVersion: true },
        data: {
          status: next,
          currentComment: comment?.trim() || null,
          ...(next === 'ENVIADO_A_MUNICIPIO' ? { sentById: userId, sentAt: now } : {}),
          ...(next === 'APROBADO_MUNICIPIO' ? { approvedById: userId, approvedAt: now } : {}),
        },
      });
      if (changed.count !== 1)
        throw new ItsReportWorkflowError('El reporte cambió mientras se procesaba la transición.');
      await transaction.reportFlowHistory.create({
        data: {
          reportId,
          previousStatus: expected,
          newStatus: next,
          userId,
          comment: comment?.trim() || null,
        },
      });
      if (next === 'DEVUELTO_POR_MUNICIPIO')
        await transaction.reportObservation.create({
          data: { reportId, userId, originLevel: 'MUNICIPAL', comment: comment!.trim() },
        });
      await transaction.auditEvent.create({
        data: {
          actorUserId: userId,
          action: `ITS2_REPORTE_${next}`,
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

  private async runWorkflowTransaction<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      // Capture also uses Serializable: reading its source rows and writing the
      // report in one snapshot prevents publishing a stale concurrent capture.
      return await this.prisma.client.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 30_000,
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2034', 'P2002'].includes(error.code)
      )
        throw new ItsReportWorkflowError(
          'Otra operación modificó las atenciones o el reporte simultáneamente. Recargue e intente nuevamente.',
        );
      throw error;
    }
  }

  private async findSelected(
    client: Pick<typeof this.prisma.client, 'itsReport'>,
    reportId: string,
  ): Promise<Its2ReportSummary> {
    const report = await client.itsReport.findUnique({
      where: { id: reportId },
      select: reportSelection,
    });
    if (!report) throw new ItsReportNotFoundError('El reporte ITS-2 no existe.');
    return this.mapReport(report);
  }

  private mapReport(report: ReportRecord): Its2ReportSummary {
    if (!report.facility || !report.municipalityId || report.period.month === null)
      throw new ItsReportWorkflowError(
        'El reporte ITS-2 no tiene territorio o período mensual válido.',
      );
    return {
      id: report.id,
      status: report.status as Its2ReportSummary['status'],
      version: report.version,
      facility: report.facility,
      municipalityId: report.municipalityId,
      year: report.period.year,
      month: report.period.month,
      totalAttentions: report.sourceAttentionCount,
      attentionTotalsComplete: report.attentionTotalsComplete,
      attentionsUnder15: report.attentionsUnder15 ?? undefined,
      attentions15Plus: report.attentions15Plus ?? undefined,
      attentionTotalsSource: report.attentionTotalsSource ?? undefined,
      currentComment: report.currentComment ?? undefined,
      generatedAt: report.generatedAt,
      sentAt: report.sentAt ?? undefined,
      approvedAt: report.approvedAt ?? undefined,
      openObservations: report.observations,
    };
  }
}
