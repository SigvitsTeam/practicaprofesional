import { StreamableFile } from '@nestjs/common';
import { DataLevel } from '../../authorization/domain/authorization.types';
import { ACCESS_REQUIREMENT_KEY } from '../../authorization/http/require-access.decorator';
import type { ItsMonthlyReport } from '../domain/its-monthly-report';
import type { MunicipalPreliminaryReport } from '../domain/municipal-consolidation';
import { MunicipalConsolidationsController } from './municipal-consolidations.controller';

const preliminaryReport: MunicipalPreliminaryReport = {
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
  notice: 'Pendiente de depuración y aprobación.',
  privacy: { smallCountThreshold: 0, suppressedValue: null },
  rows: [
    {
      id: 'facility-1',
      code: 'F1',
      name: 'Hospital',
      status: 'SIN_REPORTE',
      attentions: 2,
      newCases: 7,
      controls: 0,
      alerts: 1,
      suppressedMetrics: [],
      complementarySuppressedMetrics: [],
    },
  ],
};

describe('MunicipalConsolidationsController downloads', () => {
  it('protects the municipality context as aggregated report data for read-only users', () => {
    const contextHandler = Object.getOwnPropertyDescriptor(
      MunicipalConsolidationsController.prototype,
      'context',
    )?.value as object;
    expect(Reflect.getMetadata(ACCESS_REQUIREMENT_KEY, contextHandler)).toMatchObject({
      permission: 'its2:reports:read',
      dataLevel: DataLevel.Aggregated,
      scope: 'OWN',
    });
  });

  it('keeps the detailed ITS-2 template only for a regionally approved consolidation', async () => {
    const workflow = {
      getCurrent: jest.fn().mockResolvedValue({
        status: 'APROBADO_REGION',
        municipality: { id: 'municipality-1', code: '0506', name: 'Puerto Cortés' },
        sourceReports: [{ facility: { id: 'facility-1' } }, { facility: { id: 'facility-2' } }],
      }),
      getPreliminaryReport: jest.fn(),
    };
    const getMonthlyReport = {
      execute: jest.fn((facilityId: string) =>
        Promise.resolve({
          facility: {
            id: facilityId,
            code: facilityId,
            name: facilityId,
            municipalityName: 'Puerto Cortés',
            regionName: 'Cortés',
          },
          year: 2026,
          month: 9,
          ageGroups: [],
          rows: [],
          totalAttentions: facilityId === 'facility-1' ? 2 : 3,
          attentionsUnder15: facilityId === 'facility-1' ? 1 : 0,
          attentions15Plus: facilityId === 'facility-1' ? 1 : 3,
        } satisfies ItsMonthlyReport),
      ),
    };
    const renderXlsx = {
      execute: jest.fn().mockResolvedValue(new Uint8Array(Buffer.from('PK-municipal'))),
    };
    const renderPreliminary = { xlsx: jest.fn(), pdf: jest.fn() };
    const controller = new MunicipalConsolidationsController(
      workflow as never,
      getMonthlyReport as never,
      { execute: jest.fn() },
      renderXlsx as never,
      renderPreliminary as never,
    );

    const result = await controller.currentXlsx(
      { municipalityId: 'municipality-1', year: 2026, month: 9 },
      { userId: 'user-1' } as never,
    );

    expect(result).toBeInstanceOf(StreamableFile);
    expect(getMonthlyReport.execute).toHaveBeenCalledTimes(2);
    expect(renderXlsx.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        facility: expect.objectContaining({
          code: '0506',
          name: 'CONSOLIDADO MUNICIPAL',
        }),
        totalAttentions: 5,
        attentionsUnder15: 1,
        attentions15Plus: 4,
      }),
    );
    expect(workflow.getPreliminaryReport).not.toHaveBeenCalled();
    expect(renderPreliminary.xlsx).not.toHaveBeenCalled();
    expect(result.getHeaders()).toEqual({
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="ITS-2-Consolidado-Municipal-0506-2026-09.xlsx"',
      length: 12,
    });
  });

  it('uses the exact aggregate summary renderer for preliminary XLSX without reading individual ITS-1 rows', async () => {
    const workflow = {
      getCurrent: jest.fn().mockResolvedValue(undefined),
      getPreliminaryReport: jest.fn().mockResolvedValue(preliminaryReport),
    };
    const getMonthlyReport = { execute: jest.fn() };
    const renderXlsx = { execute: jest.fn() };
    const renderPreliminary = {
      xlsx: jest.fn().mockResolvedValue(new Uint8Array(Buffer.from('PK-preliminary'))),
      pdf: jest.fn(),
    };
    const controller = new MunicipalConsolidationsController(
      workflow as never,
      getMonthlyReport as never,
      { execute: jest.fn() },
      renderXlsx as never,
      renderPreliminary as never,
    );
    const authenticatedSubject = { userId: 'user-1' } as never;

    const result = await controller.currentXlsx(
      { municipalityId: 'municipality-1', year: 2026, month: 9 },
      authenticatedSubject,
    );

    expect(workflow.getPreliminaryReport).toHaveBeenCalledWith(
      'municipality-1',
      2026,
      9,
      authenticatedSubject,
    );
    expect(getMonthlyReport.execute).not.toHaveBeenCalled();
    expect(renderXlsx.execute).not.toHaveBeenCalled();
    expect(renderPreliminary.xlsx).toHaveBeenCalledWith(preliminaryReport);
    expect(result.getHeaders()).toEqual({
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="ITS-1-Resumen-Municipal-PRELIMINAR-0506-2026-09.xlsx"',
      length: 14,
    });
  });

  it('uses the exact aggregate summary renderer for preliminary PDF', async () => {
    const workflow = {
      getCurrent: jest.fn().mockResolvedValue({ status: 'BORRADOR' }),
      getPreliminaryReport: jest.fn().mockResolvedValue(preliminaryReport),
    };
    const renderPdf = { execute: jest.fn() };
    const renderPreliminary = {
      xlsx: jest.fn(),
      pdf: jest.fn().mockResolvedValue(new Uint8Array(Buffer.from('%PDF-preliminary'))),
    };
    const controller = new MunicipalConsolidationsController(
      workflow as never,
      { execute: jest.fn() } as never,
      renderPdf,
      { execute: jest.fn() } as never,
      renderPreliminary as never,
    );

    const result = await controller.currentPdf(
      { municipalityId: 'municipality-1', year: 2026, month: 9 },
      { userId: 'user-1' } as never,
    );

    expect(renderPdf.execute).not.toHaveBeenCalled();
    expect(renderPreliminary.pdf).toHaveBeenCalledWith(preliminaryReport);
    expect(result.getHeaders()).toEqual({
      type: 'application/pdf',
      disposition: 'attachment; filename="ITS-1-Resumen-Municipal-PRELIMINAR-0506-2026-09.pdf"',
      length: 16,
    });
  });
});
