import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ExportJobRepository } from '../application/ports/export-job.repository';
import {
  ExportJobConflictError,
  ExportArtifactExpiredError,
  ExportArtifactNotFoundError,
  type ClaimedExportJob,
  type CreateExportJobInput,
  type ExportArtifactDownload,
  type ExportJob,
} from '../domain/export-job';

@Injectable()
export class PrismaExportJobRepository extends ExportJobRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async listOwn(userId: string, limit: number): Promise<ExportJob[]> {
    const rows = await this.prisma.client.exportJob.findMany({
      where: { requestedByUserId: userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
    return rows.map((row) => this.toDomain(row));
  }

  async create(input: CreateExportJobInput): Promise<ExportJob> {
    const existing = await this.findIdempotent(input);
    if (existing) return existing;
    try {
      const row = await this.prisma.client.$transaction(async (tx) => {
        const created = await tx.exportJob.create({
          data: {
            requestedByUserId: input.requestedByUserId,
            idempotencyKey: input.idempotencyKey,
            reportType: input.reportType,
            format: input.format,
            scopeLevel: input.scopeLevel,
            territoryId: input.territoryId,
            year: input.year,
            month: input.month,
          },
        });
        await tx.auditEvent.create({
          data: {
            actorUserId: input.requestedByUserId,
            action: 'EXPORT_JOB_QUEUED',
            entity: 'EXPORT_JOB',
            entityId: created.id,
            dataLevel: 'AGREGADO',
            newData: {
              reportType: input.reportType,
              format: input.format,
              scopeLevel: input.scopeLevel,
              territoryId: input.territoryId,
              year: input.year,
              month: input.month,
            },
            requestId: input.requestId,
          },
        });
        return created;
      });
      return this.toDomain(row);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const raced = await this.findIdempotent(input);
        if (raced) return raced;
      }
      throw error;
    }
  }

  async claimNext(staleAfterMs: number): Promise<ClaimedExportJob | null> {
    const staleBefore = new Date(Date.now() - staleAfterMs);
    const rows = await this.prisma.client.$queryRaw<
      Array<{
        id: string;
        requestedByUserId: string;
        reportType: string;
        format: string;
        scopeLevel: string;
        territoryId: string | null;
        year: number;
        month: number;
        status: string;
        attempts: number;
        maxAttempts: number;
        outputStorageKey: string | null;
        outputExpiresAt: Date | null;
        errorCode: string | null;
        createdAt: Date;
        updatedAt: Date;
      }>
    >(Prisma.sql`
      WITH candidate AS (
        SELECT "id"
        FROM "trabajos_exportacion"
        WHERE "intentos" < "max_intentos"
          AND (
            "estado" IN ('PENDIENTE', 'FALLIDO')
            OR ("estado" = 'PROCESANDO' AND "iniciado_at" < ${staleBefore})
          )
        ORDER BY "created_at" ASC, "id" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE "trabajos_exportacion" AS job
      SET "estado" = 'PROCESANDO', "intentos" = job."intentos" + 1,
          "iniciado_at" = NOW(), "finalizado_at" = NULL, "codigo_error" = NULL,
          "updated_at" = NOW()
      FROM candidate
      WHERE job."id" = candidate."id"
      RETURNING job."id", job."solicitado_por_usuario_id" AS "requestedByUserId",
        job."tipo_reporte" AS "reportType", job."formato"::text AS "format",
        job."nivel_alcance"::text AS "scopeLevel", job."territorio_id" AS "territoryId",
        job."anio" AS "year", job."mes" AS "month", job."estado"::text AS "status",
        job."intentos" AS "attempts", job."max_intentos" AS "maxAttempts",
        job."storage_key_salida" AS "outputStorageKey", job."salida_expira_at" AS "outputExpiresAt",
        job."codigo_error" AS "errorCode",
        job."created_at" AS "createdAt", job."updated_at" AS "updatedAt"
    `);
    const row = rows[0];
    if (!row) return null;
    return {
      ...this.toDomain(row),
      requestedByUserId: row.requestedByUserId,
      maxAttempts: row.maxAttempts,
    };
  }

  async complete(jobId: string, storageKey: string, expiresAt: Date): Promise<void> {
    const updated = await this.prisma.client.exportJob.updateMany({
      where: { id: jobId, status: 'PROCESANDO' },
      data: {
        status: 'COMPLETADO',
        outputStorageKey: storageKey,
        outputExpiresAt: expiresAt,
        errorCode: null,
        finishedAt: new Date(),
      },
    });
    if (updated.count !== 1)
      throw new ExportJobConflictError('El trabajo ya no está en procesamiento.');
  }

  async fail(jobId: string, errorCode: string): Promise<void> {
    await this.prisma.client.exportJob.updateMany({
      where: { id: jobId, status: 'PROCESANDO' },
      data: { status: 'FALLIDO', errorCode: errorCode.slice(0, 80), finishedAt: new Date() },
    });
  }

  async acquireDownload(
    jobId: string,
    userId: string,
    requestId: string,
  ): Promise<ExportArtifactDownload> {
    return this.prisma.client.$transaction(async (tx) => {
      const job = await tx.exportJob.findFirst({
        where: { id: jobId, requestedByUserId: userId },
      });
      if (!job || job.status !== 'COMPLETADO' || !job.outputStorageKey)
        throw new ExportArtifactNotFoundError('La exportación no está disponible.');
      if (!job.outputExpiresAt || job.outputExpiresAt <= new Date())
        throw new ExportArtifactExpiredError('El archivo de exportación expiró.');
      await tx.auditEvent.create({
        data: {
          actorUserId: userId,
          action: 'EXPORT_ARTIFACT_DOWNLOAD_AUTHORIZED',
          entity: 'EXPORT_JOB',
          entityId: job.id,
          dataLevel: 'AGREGADO',
          newData: { format: job.format, reportType: job.reportType },
          requestId,
        },
      });
      return {
        storageKey: job.outputStorageKey,
        format: job.format,
        filename: `SIGVITS-${job.reportType}-${job.year}-${String(job.month).padStart(2, '0')}.${job.format.toLowerCase()}`,
      };
    });
  }

  private async findIdempotent(input: CreateExportJobInput): Promise<ExportJob | null> {
    const row = await this.prisma.client.exportJob.findUnique({
      where: {
        requestedByUserId_idempotencyKey: {
          requestedByUserId: input.requestedByUserId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (!row) return null;
    if (
      row.reportType !== input.reportType ||
      row.format !== input.format ||
      row.scopeLevel !== input.scopeLevel ||
      row.territoryId !== input.territoryId ||
      row.year !== input.year ||
      row.month !== input.month
    )
      throw new ExportJobConflictError(
        'La clave de idempotencia ya fue utilizada con otra solicitud.',
      );
    return this.toDomain(row);
  }

  private toDomain(row: {
    id: string;
    reportType: string;
    format: string;
    scopeLevel: string;
    territoryId: string | null;
    year: number;
    month: number;
    status: string;
    attempts: number;
    outputStorageKey: string | null;
    outputExpiresAt: Date | null;
    errorCode: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): ExportJob {
    return {
      id: row.id,
      reportType: row.reportType,
      format: row.format as ExportJob['format'],
      scopeLevel: row.scopeLevel as ExportJob['scopeLevel'],
      territoryId: row.territoryId,
      year: row.year,
      month: row.month,
      status: row.status as ExportJob['status'],
      attempts: row.attempts,
      outputAvailable: Boolean(
        row.outputStorageKey && row.outputExpiresAt && row.outputExpiresAt > new Date(),
      ),
      outputExpiresAt: row.outputExpiresAt,
      errorCode: row.errorCode,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
