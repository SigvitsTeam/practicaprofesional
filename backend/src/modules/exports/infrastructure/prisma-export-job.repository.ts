import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ExportJobRepository } from '../application/ports/export-job.repository';
import {
  ExportJobConflictError,
  type CreateExportJobInput,
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
      outputAvailable: Boolean(row.outputStorageKey),
      errorCode: row.errorCode,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
