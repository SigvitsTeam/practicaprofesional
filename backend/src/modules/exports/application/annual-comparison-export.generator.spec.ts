import ExcelJS from 'exceljs';
import { TerritorialAnalyticsRepository } from '../../its-capture/application/ports/territorial-analytics.repository';
import { TerritorialAnalyticsPrivacyPolicy } from '../../its-capture/application/territorial-analytics-privacy.policy';
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
        dataStatus: 'PRELIMINAR',
        dataSource: 'ITS1',
        attentions: 100,
        newCases: 10,
        controls: 5,
        alerts: 2,
      },
    ]);
  }
}

class SmallCountAnalyticsRepository extends TerritorialAnalyticsRepository {
  list(): Promise<readonly TerritorialAnalyticsRow[]> {
    return Promise.resolve([
      {
        id: 'territory-small',
        parentId: 'authorized-parent',
        code: '0506',
        name: 'Puerto Cortés',
        status: 'ENVIADO',
        dataStatus: 'PRELIMINAR',
        dataSource: 'ITS1',
        attentions: 40,
        newCases: 2,
        controls: 8,
        alerts: 0,
      },
      {
        id: 'territory-large',
        parentId: 'authorized-parent',
        code: '0507',
        name: 'Omoa',
        status: 'ENVIADO',
        dataStatus: 'PRELIMINAR',
        dataSource: 'ITS1',
        attentions: 60,
        newCases: 98,
        controls: 12,
        alerts: 0,
      },
    ]);
  }
}

const privacy = new TerritorialAnalyticsPrivacyPolicy();

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
    const contents = await new AnnualComparisonExportGenerator(repository, privacy).generate(
      baseJob,
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(contents).buffer);
    expect(repository.calls).toBe(4);
    expect(workbook.getWorksheet('Comparación')?.getCell('H7').value).toBe(30);
    expect(workbook.getWorksheet('Detalle mensual')?.rowCount).toBe(5);
  });

  it('generates a valid PDF artifact', async () => {
    const contents = await new AnnualComparisonExportGenerator(
      new AnalyticsRepository(),
      privacy,
    ).generate({ ...baseJob, format: 'PDF' });
    expect(Buffer.from(contents).subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('keeps small descendant counts numeric in monthly detail and aggregated summaries', async () => {
    const contents = await new AnnualComparisonExportGenerator(
      new SmallCountAnalyticsRepository(),
      privacy,
    ).generate(baseJob);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(contents).buffer);
    const summary = workbook.getWorksheet('Comparación');
    const detail = workbook.getWorksheet('Detalle mensual');

    expect(detail?.getCell('D2').value).toBe(100);
    expect(detail?.getCell('D3').value).toBe(100);
    expect(detail?.getCell('E2').value).toBe(20);
    expect(detail?.getCell('F2').value).toBe(120);
    expect(detail?.getCell('G2').value).toBe(0);
    expect(detail?.getCell('H2').value).toBe(1000);
    expect(summary?.getCell('D7').value).toBe(240);
    expect(summary?.getCell('E7').value).toBe(200);
    expect(summary?.getCell('F7').value).toBe(200);
    expect(summary?.getCell('G7').value).toBe(40);
    expect(summary?.getCell('H7').value).toBe(240);
    expect(summary?.getCell('I7').value).toBe(0);
    expect(summary?.getCell('J7').value).toBe(1000);
  });
});
