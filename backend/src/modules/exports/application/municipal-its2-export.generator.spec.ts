import ExcelJS from 'exceljs';
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

function source(count: number, caseType: 'NUEVO' | 'CONTROL' = 'NUEVO'): MonthlyReportSource {
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
    attentions: Array.from({ length: count }, () => ({
      ...attention,
      diagnoses: [{ diseaseId: 'disease-1', caseType }],
    })),
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

  it.each([1, 2, 3, 4])(
    'keeps all 36 ITS-2 columns and totals numeric for %i controls',
    async (count) => {
      getReportSource.mockResolvedValueOnce(source(count, 'CONTROL'));

      const contents = await generator.generate(job);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(new Uint8Array(contents).buffer);
      const sheet = workbook.getWorksheet('ITS 2');

      expect(sheet?.getCell('A5').value).toContain('PRELIMINAR · CONSULTA');
      expect(sheet?.getCell('A6').value).toContain('no corresponde a un cierre mensual oficial');
      expect(sheet?.getCell('C14').value).toBe(0);
      expect(sheet?.getCell('D14').value).toBe(count);
      for (let column = 3; column <= 38; column += 1) {
        expect(typeof sheet?.getCell(14, column).value).toBe('number');
        const total = sheet?.getCell(32, column).value;
        expect(total).toEqual(
          expect.objectContaining({
            formula: expect.any(String),
          }),
        );
        expect(total).not.toBe('PROTEGIDO');
      }
      expect(sheet?.getCell('D32').value).toEqual({
        formula: 'SUM(D14:D31)',
        result: count,
      });
    },
  );

  it('passes the real range and exact ITS-2 matrix to the PDF renderer', async () => {
    getReportSource.mockResolvedValueOnce(source(1));
    await generator.generate({ ...job, format: 'PDF' });

    expect(renderPdfExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        year: 2026,
        month: 3,
        totalAttentions: 1,
        rows: expect.arrayContaining([
          expect.objectContaining({ diagnosis: { newCases: 1, controls: 0 } }),
        ]),
      }),
      {
        periodLabel: '01–03',
        yearLabel: '2026',
        preliminaryConsultation: true,
      },
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
