import ExcelJS from 'exceljs';
import type { ItsAttentionRepository } from '../../its-capture/application/ports/its-attention.repository';
import type { RenderIts1PdfUseCase } from '../../its-capture/application/render-its1-pdf.use-case';
import { RenderIts1XlsxUseCase } from '../../its-capture/application/render-its1-xlsx.use-case';
import type { Its1PrintRegister } from '../../its-capture/domain/its1-print-register';
import type { ClaimedExportJob } from '../domain/export-job';
import { Its1ExportGenerator } from './its1-export.generator';

const register: Its1PrintRegister = {
  facility: {
    id: '33333333-3333-4333-8333-333333333333',
    code: 'F01',
    name: 'CIS Norte',
    municipalityName: 'Puerto Cortés',
    regionName: 'Cortés',
  },
  year: 2026,
  month: 8,
  responsibleName: 'Responsable',
  diseases: [{ id: 'disease-1', code: 'A01', name: 'Sífilis', formatOrder: 1 }],
  attentions: [
    {
      originText: '=unsafe',
      patientRecordNumber: '@record',
      sex: 'M',
      age: 22,
      populationTypeCode: 'GENERAL',
      isContact: false,
      isPregnant: false,
      diagnoses: [
        {
          diseaseId: 'disease-1',
          diseaseCode: 'A01',
          diseaseName: 'Sífilis',
          caseType: 'NUEVO',
        },
      ],
    },
  ],
};
const getIts1PrintRegister = jest.fn().mockResolvedValue(register);
const renderPdfExecute = jest.fn().mockResolvedValue(new Uint8Array(Buffer.from('%PDF-its1')));
const generator = new Its1ExportGenerator(
  { getIts1PrintRegister } as unknown as ItsAttentionRepository,
  { execute: renderPdfExecute } as unknown as RenderIts1PdfUseCase,
  new RenderIts1XlsxUseCase(),
);
const job: ClaimedExportJob = {
  id: '11111111-1111-4111-8111-111111111111',
  requestedByUserId: '22222222-2222-4222-8222-222222222222',
  reportType: 'ITS1_REGISTER',
  format: 'XLSX',
  scopeLevel: 'ESTABLECIMIENTO',
  territoryId: register.facility.id,
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

describe('Its1ExportGenerator', () => {
  it('generates a protected workbook and neutralizes individual text fields', async () => {
    const contents = await generator.generate(job);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(contents).buffer);
    const sheet = workbook.getWorksheet('Registro ITS');
    expect(sheet?.getCell('C5').value).toBe('Cortés');
    expect(sheet?.getCell('U5').value).toBe('CIS Norte');
    expect(sheet?.getCell('B11').value).toBe("'=unsafe");
    expect(sheet?.getCell('C11').value).toBe("'@record");
    expect(sheet?.getCell('E11').value).toBe('X');
    expect(sheet?.getCell('G11').value).toBe('X');
    expect(sheet?.getCell('K11').value).toBe('X');
    expect(sheet?.pageSetup.printArea).toBe('A1:AT35');
    expect(sheet?.model).toMatchObject({ sheetProtection: { sheet: true } });
    expect(getIts1PrintRegister).toHaveBeenCalledWith({
      facilityId: register.facility.id,
      userId: job.requestedByUserId,
      year: 2026,
      month: 8,
    });
  });

  it('delegates PDF output to the official ITS-1 renderer', async () => {
    const contents = await generator.generate({ ...job, format: 'PDF' });
    expect(Buffer.from(contents).toString('ascii')).toBe('%PDF-its1');
    expect(renderPdfExecute).toHaveBeenCalledWith(register);
  });

  it('extends the official form without dropping records beyond its first 25 rows', async () => {
    getIts1PrintRegister.mockResolvedValueOnce({
      ...register,
      attentions: Array.from({ length: 26 }, (_, index) => ({
        ...register.attentions[0]!,
        patientRecordNumber: `EXP-${index + 1}`,
      })),
    });
    const contents = await generator.generate(job);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(contents).buffer);
    const sheet = workbook.getWorksheet('Registro ITS');
    expect(sheet?.getCell('A36').value).toBe(26);
    expect(sheet?.getCell('C36').value).toBe('EXP-26');
    expect(sheet?.pageSetup.printArea).toBe('A1:AT36');
  });
});
