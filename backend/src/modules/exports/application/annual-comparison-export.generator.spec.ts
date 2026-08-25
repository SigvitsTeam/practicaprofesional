import ExcelJS from 'exceljs';
import { TerritorialAnalyticsRepository } from '../../its-capture/application/ports/territorial-analytics.repository';
import type { TerritorialAnalyticsRow } from '../../its-capture/domain/territorial-analytics';
import type { ClaimedExportJob } from '../domain/export-job';
import { AnnualComparisonExportGenerator } from './annual-comparison-export.generator';

class AnalyticsRepository extends TerritorialAnalyticsRepository {
  calls = 0;
  list(): Promise<readonly TerritorialAnalyticsRow[]> {
    this.calls += 1;
    return Promise.resolve([
      {
        id: 'territory-1',
        code: '0506',
        name: 'Puerto Cortés',
        status: 'ENVIADO',
        attentions: 100,
        newCases: 10,
        controls: 5,
        alerts: 2,
      },
    ]);
  }
}

const baseJob: ClaimedExportJob = {
  id: '11111111-1111-4111-8111-111111111111',
  requestedByUserId: '22222222-2222-4222-8222-222222222222',
  reportType: 'ANNUAL_COMPARISON',
  format: 'XLSX',
  scopeLevel: 'MUNICIPIO',
  territoryId: '33333333-3333-4333-8333-333333333333',
  year: 2026,
  month: 8,
  parameters: {
    dimension: 'periods',
    rangeAStart: '2025-01',
    rangeAEnd: '2025-02',
    rangeBStart: '2026-01',
    rangeBEnd: '2026-02',
    indicatorA: 'TOTAL_CASES',
    indicatorB: 'RATE_PER_1000',
  },
  status: 'PROCESANDO',
  attempts: 1,
  maxAttempts: 3,
  outputAvailable: false,
  outputExpiresAt: null,
  errorCode: null,
  createdAt: new Date('2026-08-25T00:00:00Z'),
  updatedAt: new Date('2026-08-25T00:00:00Z'),
};

describe('AnnualComparisonExportGenerator', () => {
  it('generates an aggregated XLSX with summary and monthly detail', async () => {
    const repository = new AnalyticsRepository();
    const contents = await new AnnualComparisonExportGenerator(repository).generate(baseJob);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(contents);
    expect(repository.calls).toBe(4);
    expect(workbook.getWorksheet('Comparación')?.getCell('H7').value).toBe(30);
    expect(workbook.getWorksheet('Detalle mensual')?.rowCount).toBe(5);
  });

  it('generates a valid PDF artifact', async () => {
    const contents = await new AnnualComparisonExportGenerator(new AnalyticsRepository()).generate({
      ...baseJob,
      format: 'PDF',
    });
    expect(Buffer.from(contents).subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
