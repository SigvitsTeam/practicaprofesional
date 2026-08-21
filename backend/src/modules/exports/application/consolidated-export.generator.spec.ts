import ExcelJS from 'exceljs';
import type { MunicipalConsolidationRepository } from '../../its-capture/application/ports/municipal-consolidation.repository';
import type { NationalConsolidationRepository } from '../../its-capture/application/ports/national-consolidation.repository';
import type { RegionalConsolidationRepository } from '../../its-capture/application/ports/regional-consolidation.repository';
import type { ClaimedExportJob } from '../domain/export-job';
import { ConsolidatedExportGenerator } from './consolidated-export.generator';

const nationalGetCurrent = jest.fn().mockResolvedValue({
  id: 'national-1',
  status: 'CONSOLIDADO_NACIONAL',
  version: 2,
  year: 2026,
  month: 8,
  periodStatus: 'ABIERTO',
  expectedRegions: 2,
  sourceReports: [
    {
      id: 'regional-1',
      version: 3,
      region: { id: 'region-1', code: '=R01', name: 'Región Norte' },
    },
  ],
  sourceAttentionCount: 120,
  attentionTotalsComplete: true,
  attentionsUnder15: 20,
  attentions15Plus: 100,
  generatedAt: new Date('2026-08-21T00:00:00Z'),
});
const regionalGetCurrent = jest.fn().mockResolvedValue({
  id: 'regional-1',
  status: 'APROBADO_CENTRAL',
  version: 3,
  region: { id: 'region-1', code: 'R01', name: 'Región Norte' },
  year: 2026,
  month: 8,
  expectedMunicipalities: 1,
  sourceReports: [
    {
      id: 'municipal-1',
      version: 4,
      municipality: { id: 'municipality-1', code: 'M01', name: 'Municipio Uno' },
    },
  ],
  sourceAttentionCount: 80,
  attentionTotalsComplete: true,
  generatedAt: new Date('2026-08-21T00:00:00Z'),
  openObservations: [],
});

const generator = new ConsolidatedExportGenerator(
  { getCurrent: jest.fn() } as unknown as MunicipalConsolidationRepository,
  { getCurrent: regionalGetCurrent } as unknown as RegionalConsolidationRepository,
  { getCurrent: nationalGetCurrent } as unknown as NationalConsolidationRepository,
);

const baseJob: ClaimedExportJob = {
  id: '11111111-1111-4111-8111-111111111111',
  requestedByUserId: '22222222-2222-4222-8222-222222222222',
  reportType: 'NATIONAL_CONSOLIDATED',
  format: 'XLSX',
  scopeLevel: 'NACIONAL',
  territoryId: null,
  year: 2026,
  month: 8,
  status: 'PROCESANDO',
  attempts: 1,
  maxAttempts: 3,
  outputAvailable: false,
  outputExpiresAt: null,
  errorCode: null,
  createdAt: new Date('2026-08-21T00:00:00Z'),
  updatedAt: new Date('2026-08-21T00:00:00Z'),
};

describe('ConsolidatedExportGenerator', () => {
  it('generates a national workbook from the persisted source report versions', async () => {
    const contents = await generator.generate(baseJob);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(contents);
    const sheet = workbook.getWorksheet('Consolidado');
    expect(sheet?.getCell('A10').value).toBe("'=R01");
    expect(sheet?.getCell('C10').value).toBe(3);
    expect(nationalGetCurrent).toHaveBeenCalledWith({ year: 2026, month: 8 });
  });

  it('generates a regional PDF from the current persisted consolidation', async () => {
    const contents = await generator.generate({
      ...baseJob,
      reportType: 'REGIONAL_CONSOLIDATED',
      format: 'PDF',
      scopeLevel: 'REGION',
      territoryId: '33333333-3333-4333-8333-333333333333',
    });
    expect(Buffer.from(contents).subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(regionalGetCurrent).toHaveBeenCalledWith({
      regionId: '33333333-3333-4333-8333-333333333333',
      year: 2026,
      month: 8,
    });
  });
});
