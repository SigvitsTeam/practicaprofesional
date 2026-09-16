import ExcelJS from 'exceljs';
import { ConfigService } from '@nestjs/config';
import type { MunicipalConsolidationRepository } from '../../its-capture/application/ports/municipal-consolidation.repository';
import type { NationalConsolidationRepository } from '../../its-capture/application/ports/national-consolidation.repository';
import type { RegionalConsolidationRepository } from '../../its-capture/application/ports/regional-consolidation.repository';
import { TerritorialAnalyticsPrivacyPolicy } from '../../its-capture/application/territorial-analytics-privacy.policy';
import type { ClaimedExportJob } from '../domain/export-job';
import { ConsolidatedExportGenerator } from './consolidated-export.generator';

const nationalGetCurrent = jest.fn().mockResolvedValue({
  id: 'national-1',
  status: 'CERRADO_OFICIAL',
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
const municipalGetCurrent = jest.fn();
const analyticsList = jest.fn().mockResolvedValue([
  {
    id: 'facility-1',
    parentId: 'municipality-1',
    code: '=E01',
    name: 'Establecimiento Uno',
    status: 'SIN_REPORTE',
    dataStatus: 'PRELIMINAR',
    dataSource: 'ITS1',
    attentions: 12,
    newCases: 4,
    controls: 8,
    alerts: 0,
  },
  {
    id: 'facility-2',
    parentId: 'municipality-1',
    code: 'E02',
    name: 'Establecimiento Dos',
    status: 'SIN_REPORTE',
    dataStatus: 'PRELIMINAR',
    dataSource: 'ITS1',
    attentions: 20,
    newCases: 6,
    controls: 10,
    alerts: 0,
  },
]);

const generator = new ConsolidatedExportGenerator(
  { getCurrent: municipalGetCurrent } as unknown as MunicipalConsolidationRepository,
  { getCurrent: regionalGetCurrent } as unknown as RegionalConsolidationRepository,
  { getCurrent: nationalGetCurrent } as unknown as NationalConsolidationRepository,
  { list: analyticsList },
  new TerritorialAnalyticsPrivacyPolicy(
    new ConfigService({ app: { territorialAnalyticsSmallCountThreshold: 5 } }),
  ),
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
  parameters: null,
  outputExpiresAt: null,
  errorCode: null,
  createdAt: new Date('2026-08-21T00:00:00Z'),
  updatedAt: new Date('2026-08-21T00:00:00Z'),
};

describe('ConsolidatedExportGenerator', () => {
  it('generates a national workbook from the persisted source report versions', async () => {
    const contents = await generator.generate(baseJob);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(contents).buffer);
    const sheet = workbook.getWorksheet('Consolidado');
    expect(sheet?.getCell('A11').value).toBe("'=R01");
    expect(sheet?.getCell('C11').value).toBe(3);
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

  it('generates a preliminary municipal workbook directly from ITS-1 when ITS-2 is unavailable', async () => {
    municipalGetCurrent.mockResolvedValueOnce(undefined);
    const contents = await generator.generate({
      ...baseJob,
      reportType: 'MUNICIPAL_CONSOLIDATED',
      scopeLevel: 'MUNICIPIO',
      territoryId: '33333333-3333-4333-8333-333333333333',
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(contents).buffer);
    const sheet = workbook.getWorksheet('Consolidado');

    expect(sheet?.getCell('A5').value).toContain('datos preliminares');
    expect(sheet?.getCell('A11').value).toBe("'=E01");
    expect(sheet?.getCell('E11').value).toBe(12);
    expect(sheet?.getCell('F11').value).toBe('SUPRIMIDO');
    expect(sheet?.getCell('F12').value).toBe('SUPRIMIDO');
    expect(sheet?.getCell('A7').value).toContain('Atenciones: 32');
    expect(sheet?.getCell('A7').value).toContain('Casos nuevos: SUPRIMIDO');
    expect(sheet?.getCell('A7').value).toContain('Controles: 18');
    expect(analyticsList).toHaveBeenCalledWith({
      level: 'ESTABLECIMIENTO',
      year: 2026,
      month: 8,
      municipalityId: '33333333-3333-4333-8333-333333333333',
      scope: { national: true, regionIds: [], municipalityIds: [], facilityIds: [] },
    });
  });
});
