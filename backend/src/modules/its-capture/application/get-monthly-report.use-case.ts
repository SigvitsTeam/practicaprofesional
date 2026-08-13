import { Injectable } from '@nestjs/common';
import { buildItsMonthlyReport, type ItsMonthlyReport } from '../domain/its-monthly-report';
import { ItsAttentionRepository } from './ports/its-attention.repository';

@Injectable()
export class GetMonthlyReportUseCase {
  constructor(private readonly repository: ItsAttentionRepository) {}

  async execute(facilityId: string, year: number, month: number): Promise<ItsMonthlyReport> {
    const source = await this.repository.getMonthlyReportSource({ facilityId, year, month });
    return buildItsMonthlyReport(source, year, month);
  }
}
