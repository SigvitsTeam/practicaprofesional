import { ConfigService } from '@nestjs/config';
import ExcelJS from 'exceljs';
import { Its2MatrixPrivacyPolicy } from '../../its-capture/application/its2-matrix-privacy.policy';
import { RenderIts2XlsxUseCase } from '../../its-capture/application/render-its2-xlsx.use-case';
import type { MonthlyReportSource } from '../../its-capture/domain/its-monthly-report';
import type { ClaimedExportJob, ResolvedMunicipalExportRange } from '../domain/export-job';
import { MunicipalIts2ExportGenerator } from './municipal-its2-export.generator';
import type { MunicipalIts2ExportRepository } from './ports/municipal-its2-export.repository';

const range: ResolvedMunicipalExportRange = {
  parameters: {
    timeUnit: 'MONTH',
    startPeriod: '2026-01',
    endPeriod: '2026-03',
  },
  startDate: new Date('2026-01-01T00:00:00.000Z'),
  endDate: new Date('2026-03-31T00:00:00.000Z'),
  anchorYear: 2026,
  anchorMonth: 3,
  periodLabel: '01–03',
  yearLabel: '2026',
  filenameLabel: 'MES-2026-01_a_2026-03',
};

const attention = {
  sex: 'M' as const,
  age: 24,
  ageGroupCode: '20_24',
  populationTypeCode: 'GENERAL',
  isContact: false,
  isPregnant: false,
  diagnoses: [{ diseaseId: 'disease-1', caseType: 'NUEVO' as const }],
};

function source(count: number): MonthlyReportSource {
  return {
    facility: {
      id: 'municipality-1',
      code: 'M0506',
      name: 'CONSOLIDADO MUNICIPAL',
      municipalityName: 'Puerto Cortés',
      regionName: 'Cortés',
    },
    ageGroups: [{ code: '20_24', name: '20 a 24', formatOrder: 1 }],
    diseases: [
      {
        id: 'disease-1',
        code: 'SIF',
        name: 'Sífilis',
        classificationCode: 'ITS',
        classificationName: 'ITS',
        appliesToMale: true,
        appliesToFemale: true,
        formatOrder: 1,
      },
    ],
    attentions: Array.from({ length: count }, () => ({ ...attention })),
  };
}

const job: ClaimedExportJob = {
  id: '11111111-1111-4111-8111-111111111111',
  requestedByUserId: '22222222-2222-4222-8222-222222222222',
  reportType: 'MUNICIPAL_CONSOLIDATED',
  format: 'XLSX',
  scopeLevel: 'MUNICIPIO',
  territoryId: 'municipality-1',
  year: 2026,
  month: 3,
  parameters: range.parameters,
  status: 'PROCESANDO',
  attempts: 1,
  maxAttempts: 3,
  outputAvailable: false,
  outputExpiresAt: null,
  errorCode: null,
  createdAt: new Date('2026-03-31T00:00:00.000Z'),
  updatedAt: new Date('2026-03-31T00:00:00.000Z'),
};

describe('MunicipalIts2ExportGenerator', () => {
  const resolveRange = jest.fn().mockResolvedValue(range);
  const getReportSource = jest.fn().mockResolvedValue(source(6));
  const renderPdfExecute = jest.fn().mockResolvedValue(new Uint8Array(Buffer.from('%PDF-test')));
  const repository = {
    resolveRange,
    getReportSource,
  } as unknown as MunicipalIts2ExportRepository;
  const generator = new MunicipalIts2ExportGenerator(
    repository,
    new Its2MatrixPrivacyPolicy(
      new ConfigService({ app: { territorialAnalyticsSmallCountThreshold: 5 } }),
    ),
    { execute: renderPdfExecute },
    new RenderIts2XlsxUseCase(),
  );

  beforeEach(() => {
    jest.clearAllMocks();
    resolveRange.mockResolvedValue(range);
    getReportSource.mockResolvedValue(source(6));
  });

  it('renders the inclusive municipal range in the official ITS-2 matrix', async () => {
    const contents = await generator.generate(job);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(contents).buffer);
    const sheet = workbook.getWorksheet('ITS 2');

    expect(resolveRange).toHaveBeenCalledWith(range.parameters);
    expect(getReportSource).toHaveBeenCalledWith({ municipalityId: 'municipality-1', range });
    expect(sheet?.getCell('A5').value).toContain('PRELIMINAR · CONSULTA');
    expect(sheet?.getCell('C9').value).toBe('01–03');
    expect(sheet?.getCell('K9').value).toBe('2026');
    expect(sheet?.getCell('AA7').value).toContain('PRELIMINAR · CONSULTA');
    expect(sheet?.getCell('C14').value).toBe(6);
    expect(sheet?.getCell('C32').value).toEqual({ formula: 'SUM(C14:C31)', result: 6 });
  });

  it('protects the complete row and every total when the range contains a small cell', async () => {
    getReportSource.mockResolvedValueOnce(source(1));

    const contents = await generator.generate(job);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(contents).buffer);
    const sheet = workbook.getWorksheet('ITS 2');

    expect(sheet?.getCell('C14').value).toBe('PROTEGIDO');
    expect(sheet?.getCell('AL14').value).toBe('PROTEGIDO');
    expect(sheet?.getCell('C32').value).toBe('PROTEGIDO');
    expect(sheet?.getCell('AL32').value).toBe('PROTEGIDO');
  });

  it('passes the real range and privacy options to the PDF renderer', async () => {
    await generator.generate({ ...job, format: 'PDF' });

    expect(renderPdfExecute).toHaveBeenCalledWith(
      expect.objectContaining({ year: 2026, month: 3, totalAttentions: 6 }),
      expect.objectContaining({
        periodLabel: '01–03',
        yearLabel: '2026',
        preliminaryConsultation: true,
        protection: expect.objectContaining({ protectTotals: false }),
      }),
    );
  });

  it('keeps legacy municipal jobs as a one-month ITS-2 query', async () => {
    await generator.generate({ ...job, parameters: null, year: 2026, month: 8 });

    expect(resolveRange).toHaveBeenCalledWith({
      timeUnit: 'MONTH',
      startPeriod: '2026-08',
      endPeriod: '2026-08',
    });
  });
});
