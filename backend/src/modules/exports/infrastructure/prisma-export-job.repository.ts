import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ExportJobRepository } from '../application/ports/export-job.repository';
import type { ExpiredArtifact } from '../application/ports/export-job.repository';
import {
  ExportJobConflictError,
  ExportArtifactExpiredError,
  ExportArtifactNotFoundError,
  type ClaimedExportJob,
  type CreateExportJobInput,
  type ExportArtifactDownload,
  type ExportJob,
  type ExportJobClaim,
} from '../domain/export-job';

const MAX_EXHAUSTED_RECOVERIES_PER_POLL = 25;
const EXHAUSTED_ATTEMPTS_ERROR_CODE = 'EXPORT_ATTEMPTS_EXHAUSTED';

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
            parameters: input.parameters
              ? (input.parameters as Prisma.InputJsonObject)
              : Prisma.DbNull,
          },
        });
        await tx.auditEvent.create({
          data: {
            actorUserId: input.requestedByUserId,
            action: 'EXPORT_JOB_QUEUED',
            entity: 'EXPORT_JOB',
            entityId: created.id,
            dataLevel: input.reportType === 'ITS1_REGISTER' ? 'INDIVIDUAL' : 'AGREGADO',
            newData: {
              reportType: input.reportType,
              format: input.format,
              scopeLevel: input.scopeLevel,
              territoryId: input.territoryId,
              year: input.year,
              month: input.month,
              parameters: input.parameters ?? null,
            } as Prisma.InputJsonObject,
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

  async recoverStaleExhausted(staleAfterMs: number): Promise<number> {
    const staleBefore = new Date(Date.now() - staleAfterMs);
    return this.prisma.client.$transaction(async (tx) => {
      const recovered = await tx.$queryRaw<
        Array<{ id: string; attempts: number; reportType: string }>
      >(Prisma.sql`
        WITH exhausted AS (
          SELECT "id", "intentos"
          FROM "trabajos_exportacion"
          WHERE "estado" = 'PROCESANDO'
            AND "intentos" >= "max_intentos"
            AND "iniciado_at" < ${staleBefore}
          ORDER BY "iniciado_at" ASC, "id" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT ${MAX_EXHAUSTED_RECOVERIES_PER_POLL}
        )
        UPDATE "trabajos_exportacion" AS job
        SET "estado" = 'FALLIDO', "codigo_error" = ${EXHAUSTED_ATTEMPTS_ERROR_CODE},
            "finalizado_at" = NOW(), "updated_at" = NOW()
        FROM exhausted
        WHERE job."id" = exhausted."id"
          AND job."intentos" = exhausted."intentos"
          AND job."estado" = 'PROCESANDO'
          AND job."intentos" >= job."max_intentos"
          AND job."iniciado_at" < ${staleBefore}
        RETURNING job."id", job."intentos" AS "attempts", job."tipo_reporte" AS "reportType"
      `);
      if (recovered.length > 0) {
        await tx.auditEvent.createMany({
          data: recovered.map((job) => ({
            action: 'EXPORT_JOB_ATTEMPTS_EXHAUSTED',
            entity: 'EXPORT_JOB',
            entityId: job.id,
            dataLevel: job.reportType === 'ITS1_REGISTER' ? 'INDIVIDUAL' : 'AGREGADO',
            previousData: { status: 'PROCESANDO', attempts: job.attempts },
            newData: {
              status: 'FALLIDO',
              attempts: job.attempts,
              errorCode: EXHAUSTED_ATTEMPTS_ERROR_CODE,
            },
            reason: 'El último intento de exportación venció sin confirmar su finalización.',
            requestId: `export-worker:${job.id}:attempt:${job.attempts}`,
          })),
        });
      }
      return recovered.length;
    });
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
        parameters: Prisma.JsonValue | null;
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
        job."anio" AS "year", job."mes" AS "month", job."parametros" AS "parameters",
        job."estado"::text AS "status",
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

  async complete(claim: ExportJobClaim, storageKey: string, expiresAt: Date): Promise<boolean> {
    const updated = await this.prisma.client.exportJob.updateMany({
      where: { id: claim.id, attempts: claim.attempts, status: 'PROCESANDO' },
      data: {
        status: 'COMPLETADO',
        outputStorageKey: storageKey,
        outputExpiresAt: expiresAt,
        errorCode: null,
        finishedAt: new Date(),
      },
    });
    return updated.count === 1;
  }

  async fail(claim: ExportJobClaim, errorCode: string): Promise<boolean> {
    const updated = await this.prisma.client.exportJob.updateMany({
      where: { id: claim.id, attempts: claim.attempts, status: 'PROCESANDO' },
      data: { status: 'FALLIDO', errorCode: errorCode.slice(0, 80), finishedAt: new Date() },
    });
    return updated.count === 1;
  }

  async listExpiredArtifacts(expiredBefore: Date, limit: number): Promise<ExpiredArtifact[]> {
    const rows = await this.prisma.client.exportJob.findMany({
      where: {
        outputStorageKey: { not: null },
        outputExpiresAt: { lte: expiredBefore },
      },
      orderBy: [{ outputExpiresAt: 'asc' }, { id: 'asc' }],
      take: limit,
      select: { id: true, outputStorageKey: true, outputExpiresAt: true },
    });
    return rows.flatMap((row) =>
      row.outputStorageKey && row.outputExpiresAt
        ? [
            {
              jobId: row.id,
              storageKey: row.outputStorageKey,
              expiredAt: row.outputExpiresAt,
            },
          ]
        : [],
    );
  }

  async clearArtifact(jobId: string, storageKey: string): Promise<boolean> {
    const updated = await this.prisma.client.exportJob.updateMany({
      where: { id: jobId, outputStorageKey: storageKey },
      data: { outputStorageKey: null },
    });
    return updated.count === 1;
  }

  async getOwnDownload(jobId: string, userId: string): Promise<ExportArtifactDownload> {
    const job = await this.prisma.client.exportJob.findFirst({
      where: { id: jobId, requestedByUserId: userId },
    });
    if (!job || job.status !== 'COMPLETADO')
      throw new ExportArtifactNotFoundError('La exportación no está disponible.');
    if (!job.outputExpiresAt || job.outputExpiresAt <= new Date())
      throw new ExportArtifactExpiredError('El archivo de exportación expiró.');
    if (!job.outputStorageKey)
      throw new ExportArtifactNotFoundError('La exportación no está disponible.');
    return {
      storageKey: job.outputStorageKey,
      format: job.format,
      filename: `SIGVITS-${job.reportType}-${job.year}-${String(job.month).padStart(2, '0')}.${job.format.toLowerCase()}`,
      reportType: job.reportType,
      scopeLevel: job.scopeLevel,
      territoryId: job.territoryId,
    };
  }

  async recordDownloadServed(
    jobId: string,
    userId: string,
    requestId: string,
    dataLevel: 'INDIVIDUAL' | 'AGREGADO',
  ): Promise<void> {
    await this.prisma.client.auditEvent.create({
      data: {
        actorUserId: userId,
        action: 'EXPORT_ARTIFACT_SERVED',
        entity: 'EXPORT_JOB',
        entityId: jobId,
        dataLevel,
        requestId,
      },
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
      row.month !== input.month ||
      this.canonicalJson(row.parameters) !== this.canonicalJson(input.parameters ?? null)
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
    parameters: Prisma.JsonValue | null;
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
      parameters:
        row.parameters && typeof row.parameters === 'object' && !Array.isArray(row.parameters)
          ? row.parameters
          : null,
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

  private canonicalJson(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map((item) => this.canonicalJson(item)).join(',')}]`;
    if (value && typeof value === 'object')
      return `{${Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => `${JSON.stringify(key)}:${this.canonicalJson(item)}`)
        .join(',')}}`;
    return JSON.stringify(value) ?? 'null';
  }
}
