import ExcelJS from 'exceljs';
import { TerritorialAnalyticsRepository } from '../../its-capture/application/ports/territorial-analytics.repository';
import type { TerritorialAnalyticsRow } from '../../its-capture/domain/territorial-analytics';
import type { ClaimedExportJob } from '../domain/export-job';
import { TerritorialExportGenerator } from './territorial-export.generator';

class AnalyticsRepository extends TerritorialAnalyticsRepository {
  list(): Promise<readonly TerritorialAnalyticsRow[]> {
    return Promise.resolve([
      {
        id: 'region-1',
        code: '=unsafe',
        name: 'Región Norte',
        status: 'ENVIADO',
        attentions: 10,
        newCases: 3,
        controls: 7,
        alerts: 1,
      },
    ]);
  }
}

const baseJob: ClaimedExportJob = {
  id: '11111111-1111-4111-8111-111111111111',
  requestedByUserId: '22222222-2222-4222-8222-222222222222',
  reportType: 'TERRITORIAL_SUMMARY',
  format: 'XLSX',
  scopeLevel: 'NACIONAL',
  territoryId: null,
  year: 2026,
  month: 8,
  status: 'PROCESANDO',
  attempts: 1,
  maxAttempts: 3,
  outputAvailable: false,
  parameters: null,
  outputExpiresAt: null,
  errorCode: null,
  createdAt: new Date('2026-08-21T00:00:00Z'),
  updatedAt: new Date('2026-08-21T00:00:00Z'),
};

describe('TerritorialExportGenerator', () => {
  const generator = new TerritorialExportGenerator(new AnalyticsRepository());

  it('generates a valid XLSX and neutralizes spreadsheet formulas', async () => {
    const contents = await generator.generate(baseJob);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(contents);
    expect(workbook.getWorksheet('Resumen territorial')?.getCell('A5').value).toBe("'=unsafe");
  });

  it('generates a valid PDF artifact', async () => {
    const contents = await generator.generate({ ...baseJob, format: 'PDF' });
    expect(Buffer.from(contents).subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
