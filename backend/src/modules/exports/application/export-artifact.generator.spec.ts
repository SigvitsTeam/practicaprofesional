import type { ClaimedExportJob } from '../domain/export-job';
import { ExportArtifactGenerator } from './export-artifact.generator';

const job: ClaimedExportJob = {
  id: '11111111-1111-4111-8111-111111111111',
  requestedByUserId: '22222222-2222-4222-8222-222222222222',
  reportType: 'MUNICIPAL_CONSOLIDATED',
  format: 'XLSX',
  scopeLevel: 'MUNICIPIO',
  territoryId: '33333333-3333-4333-8333-333333333333',
  year: 2026,
  month: 3,
  parameters: { timeUnit: 'MONTH', startPeriod: '2026-01', endPeriod: '2026-03' },
  status: 'PROCESANDO',
  attempts: 1,
  maxAttempts: 3,
  outputAvailable: false,
  outputExpiresAt: null,
  errorCode: null,
  createdAt: new Date('2026-03-31T00:00:00.000Z'),
  updatedAt: new Date('2026-03-31T00:00:00.000Z'),
};

describe('ExportArtifactGenerator', () => {
  it('routes municipal consolidations to the dedicated ITS-2 generator', async () => {
    const municipalGenerate = jest
      .fn()
      .mockResolvedValue(new Uint8Array(Buffer.from('municipal-its2')));
    const consolidatedGenerate = jest.fn();
    const generator = new ExportArtifactGenerator(
      { generate: jest.fn() } as never,
      { generate: jest.fn() } as never,
      { generate: consolidatedGenerate } as never,
      { generate: jest.fn() } as never,
      { generate: jest.fn() } as never,
      { generate: municipalGenerate } as never,
    );

    await expect(generator.generate(job)).resolves.toEqual(
      new Uint8Array(Buffer.from('municipal-its2')),
    );
    expect(municipalGenerate).toHaveBeenCalledWith(job);
    expect(consolidatedGenerate).not.toHaveBeenCalled();
  });
});
