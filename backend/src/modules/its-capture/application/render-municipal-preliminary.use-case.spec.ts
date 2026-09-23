import ExcelJS from 'exceljs';
import { PDFDocument } from 'pdf-lib';
import type { MunicipalPreliminaryReport } from '../domain/municipal-consolidation';
import { RenderMunicipalPreliminaryUseCase } from './render-municipal-preliminary.use-case';

const report: MunicipalPreliminaryReport = {
  municipality: {
    id: 'municipality-1',
    code: '0506',
    name: 'Puerto Cortés',
    regionId: 'region-1',
    regionName: 'Cortés',
  },
  year: 2026,
  month: 9,
  dataStatus: 'PRELIMINAR',
  dataSource: 'ITS1',
  notice:
    'Datos preliminares acumulados automáticamente desde ITS 1; pendientes de depuración y aprobación institucional.',
  privacy: { smallCountThreshold: 0, suppressedValue: null },
  rows: [
    {
      id: 'facility-small',
      code: 'F1',
      name: 'Establecimiento con conteos bajos',
      status: 'SIN_REPORTE',
      attentions: 2,
      newCases: 1,
      controls: 0,
      alerts: 3,
      suppressedMetrics: [],
      complementarySuppressedMetrics: [],
    },
    {
      id: 'facility-visible',
      code: '=FORMULA',
      name: 'Establecimiento visible',
      status: 'APROBADO_MUNICIPIO',
      attentions: 12,
      newCases: 8,
      controls: 4,
      alerts: 0,
      suppressedMetrics: [],
      complementarySuppressedMetrics: [],
    },
  ],
};

describe('RenderMunicipalPreliminaryUseCase', () => {
  const renderer = new RenderMunicipalPreliminaryUseCase();

  it('creates an explicitly preliminary XLSX with exact numeric counts and totals', async () => {
    const output = await renderer.xlsx(report);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(output).buffer);
    const sheet = workbook.getWorksheet('Preliminar ITS-1');

    expect(sheet?.getCell('A5').value).toContain('PRELIMINAR ITS-1');
    expect(sheet?.getCell('A6').value).not.toContain('SUPRIMIDO');
    expect(sheet?.getCell('A7').value).toContain('Totales exactos');
    expect(sheet?.getCell('A7').value).toContain('Atenciones: 14');
    expect(sheet?.getCell('A7').value).toContain('Casos nuevos: 9');
    expect(sheet?.getCell('A7').value).toContain('Controles: 4');
    expect(sheet?.getCell('A7').value).toContain('Alertas: 3');
    expect(sheet?.getCell('D9').value).toBe(2);
    expect(sheet?.getCell('E9').value).toBe(1);
    expect(sheet?.getCell('F9').value).toBe(0);
    expect(sheet?.getCell('G9').value).toBe(3);
    expect(sheet?.getCell('D10').value).toBe(12);
    expect(sheet?.getCell('A10').value).toBe("'=FORMULA");
  });

  it('creates a PDF identified as a preliminary ITS-1 summary', async () => {
    const output = await renderer.pdf(report);
    const document = await PDFDocument.load(output);

    expect(Buffer.from(output).subarray(0, 4).toString('ascii')).toBe('%PDF');
    expect(document.getTitle()).toBe('Preliminar ITS-1 municipal 0506 2026-09');
    expect(document.getSubject()).toContain('preliminares');
  });
});
