import ExcelJS from 'exceljs';
import type { GetMonthlyReportUseCase } from '../../its-capture/application/get-monthly-report.use-case';
import type { RenderIts2PdfUseCase } from '../../its-capture/application/render-its2-pdf.use-case';
import { buildItsMonthlyReport } from '../../its-capture/domain/its-monthly-report';
import type { ClaimedExportJob } from '../domain/export-job';
import { Its2ExportGenerator } from './its2-export.generator';

const report = buildItsMonthlyReport(
  {
    facility: {
      id: '33333333-3333-4333-8333-333333333333',
      code: '=unsafe',
      name: 'CIS Norte',
      municipalityName: 'Puerto Cortés',
      regionName: 'Cortés',
    },
    ageGroups: [{ code: '15_19', name: '15 a 19', formatOrder: 1 }],
    diseases: [
      {
        id: 'disease-1',
        code: '@formula',
        name: 'Sífilis',
        classificationCode: 'A',
        classificationName: 'ITS',
        appliesToMale: true,
        appliesToFemale: true,
        formatOrder: 1,
      },
    ],
    attentions: [
      {
        sex: 'F',
        ageGroupCode: '15_19',
        populationTypeCode: 'GENERAL',
        isContact: false,
        isPregnant: false,
        diagnoses: [{ diseaseId: 'disease-1', caseType: 'NUEVO' }],
      },
    ],
  },
  2026,
  8,
);

const job: ClaimedExportJob = {
  id: '11111111-1111-4111-8111-111111111111',
  requestedByUserId: '22222222-2222-4222-8222-222222222222',
  reportType: 'ITS2_MONTHLY',
  format: 'XLSX',
  scopeLevel: 'ESTABLECIMIENTO',
  territoryId: report.facility.id,
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

describe('Its2ExportGenerator', () => {
  const renderPdfExecute = jest.fn().mockResolvedValue(new Uint8Array(Buffer.from('%PDF-test')));
  const getMonthlyReport = {
    execute: jest.fn().mockResolvedValue(report),
  } as unknown as GetMonthlyReportUseCase;
  const renderPdf = {
    execute: renderPdfExecute,
  } as unknown as RenderIts2PdfUseCase;
  const generator = new Its2ExportGenerator(getMonthlyReport, renderPdf);

  it('generates the monthly ITS-2 workbook and neutralizes formula-like codes', async () => {
    const contents = await generator.generate(job);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(contents);
    const sheet = workbook.getWorksheet('ITS 2');
    expect(sheet?.getCell('D7').value).toBe('Cortés');
    expect(sheet?.getCell('AA9').value).toBe("'=unsafe");
    expect(sheet?.getCell('B14').value).toBe('01. Sífilis');
    expect(sheet?.getCell('C14').value).toBe(1);
    expect(sheet?.getCell('F14').value).toBe(1);
    expect(sheet?.getCell('H14').value).toBe(1);
    expect(sheet?.getCell('Y14').value).toBe(0);
    expect(sheet?.getCell('AA14').value).toBe(1);
    expect(sheet?.getCell('C32').value).toEqual({ formula: 'SUM(C14:C31)', result: 1 });
    expect(sheet?.pageSetup.printArea).toBe('A1:AL32');
    expect(sheet?.model.sheetProtection?.sheet).toBe(true);
  });

  it('delegates PDF output to the official ITS-2 renderer', async () => {
    const contents = await generator.generate({ ...job, format: 'PDF' });
    expect(Buffer.from(contents).toString('ascii')).toBe('%PDF-test');
    expect(renderPdfExecute).toHaveBeenCalledWith(report);
  });
});
