import { StreamableFile } from '@nestjs/common';
import type { ItsMonthlyReport } from '../domain/its-monthly-report';
import { MunicipalConsolidationsController } from './municipal-consolidations.controller';

describe('MunicipalConsolidationsController official downloads', () => {
  it('streams the sum of every establishment included in the current municipal consolidation', async () => {
    const workflow = {
      getCurrent: jest.fn().mockResolvedValue({
        municipality: { id: 'municipality-1', code: '0506', name: 'Puerto Cortés' },
        sourceReports: [{ facility: { id: 'facility-1' } }, { facility: { id: 'facility-2' } }],
      }),
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
    const controller = new MunicipalConsolidationsController(
      workflow as never,
      getMonthlyReport as never,
      { execute: jest.fn() },
      renderXlsx as never,
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
    expect(result.getHeaders()).toEqual({
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="ITS-2-Consolidado-Municipal-0506-2026-09.xlsx"',
      length: 12,
    });
  });
});
