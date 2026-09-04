import { StreamableFile } from '@nestjs/common';
import { ItsAttentionsController } from './its-attentions.controller';

describe('ItsAttentionsController official downloads', () => {
  const facilityId = '11111111-1111-4111-8111-111111111111';
  const query = { facilityId, year: 2026, month: 9 };

  function setup(): { controller: ItsAttentionsController } {
    const monthlyReport = {
      facility: { id: facilityId, code: '2739', name: 'CIS Bajamar' },
      year: 2026,
      month: 9,
    };
    const register = {
      facility: { id: facilityId, code: '2739', name: 'CIS Bajamar' },
      year: 2026,
      month: 9,
    };
    const getMonthlyReport = { execute: jest.fn().mockResolvedValue(monthlyReport) };
    const repository = { getIts1PrintRegister: jest.fn().mockResolvedValue(register) };
    const renderIts1Pdf = {
      execute: jest.fn().mockResolvedValue(new Uint8Array(Buffer.from('%PDF-its1'))),
    };
    const renderIts2Pdf = {
      execute: jest.fn().mockResolvedValue(new Uint8Array(Buffer.from('%PDF-its2'))),
    };
    const renderIts1Xlsx = {
      execute: jest.fn().mockResolvedValue(new Uint8Array(Buffer.from('PK-its1'))),
    };
    const renderIts2Xlsx = {
      execute: jest.fn().mockResolvedValue(new Uint8Array(Buffer.from('PK-its2'))),
    };
    const controller = new ItsAttentionsController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      getMonthlyReport as never,
      repository as never,
      renderIts1Pdf as never,
      renderIts2Pdf,
      renderIts1Xlsx as never,
      renderIts2Xlsx as never,
    );
    return { controller };
  }

  it('streams the ITS-1 register as PDF bytes instead of JSON-serializing the Buffer', async () => {
    const { controller } = setup();

    const result = await controller.printRegister(query, { userId: 'user-1' } as never);

    expect(result).toBeInstanceOf(StreamableFile);
    expect(result.getHeaders()).toEqual({
      type: 'application/pdf',
      disposition: 'attachment; filename="ITS-1-2739-2026-09.pdf"',
      length: 9,
    });
    expect(result.getStream().read()).toEqual(Buffer.from('%PDF-its1'));
  });

  it('streams the ITS-2 report as PDF bytes instead of JSON-serializing the Buffer', async () => {
    const { controller } = setup();

    const result = await controller.monthlyReportPdf(query);

    expect(result).toBeInstanceOf(StreamableFile);
    expect(result.getHeaders()).toEqual({
      type: 'application/pdf',
      disposition: 'attachment; filename="ITS-2-2739-2026-09.pdf"',
      length: 9,
    });
    expect(result.getStream().read()).toEqual(Buffer.from('%PDF-its2'));
  });

  it('streams the official ITS-1 workbook with its XLSX filename and content type', async () => {
    const { controller } = setup();

    const result = await controller.printRegisterXlsx(query, { userId: 'user-1' } as never);

    expect(result).toBeInstanceOf(StreamableFile);
    expect(result.getHeaders()).toEqual({
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="ITS-1-2739-2026-09.xlsx"',
      length: 7,
    });
    expect(result.getStream().read()).toEqual(Buffer.from('PK-its1'));
  });

  it('streams the official ITS-2 workbook with its XLSX filename and content type', async () => {
    const { controller } = setup();

    const result = await controller.monthlyReportXlsx(query);

    expect(result).toBeInstanceOf(StreamableFile);
    expect(result.getHeaders()).toEqual({
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="ITS-2-2739-2026-09.xlsx"',
      length: 7,
    });
    expect(result.getStream().read()).toEqual(Buffer.from('PK-its2'));
  });
});
