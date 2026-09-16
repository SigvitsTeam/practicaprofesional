import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PrismaMunicipalConsolidationRepository } from './prisma-municipal-consolidation.repository';

describe('PrismaMunicipalConsolidationRepository.getPreliminaryReportSource', () => {
  const municipalityFindFirst = jest.fn();
  const repository = new PrismaMunicipalConsolidationRepository({
    client: { municipality: { findFirst: municipalityFindFirst } },
  } as unknown as PrismaService);

  beforeEach(() => jest.resetAllMocks());

  it('includes inactive municipalities and facilities only when they contributed active attentions in the period', async () => {
    municipalityFindFirst.mockResolvedValue({
      id: 'municipality-inactive',
      officialCode: '0507',
      name: 'Municipio histórico',
      region: { id: 'region-1', name: 'Cortés' },
      facilities: [
        { id: 'facility-active', code: 'F1', name: 'Activo' },
        { id: 'facility-historic', code: 'F2', name: 'Histórico' },
      ],
    });

    await expect(
      repository.getPreliminaryReportSource({
        municipalityId: 'municipality-inactive',
        year: 2025,
        month: 12,
      }),
    ).resolves.toMatchObject({
      municipality: { id: 'municipality-inactive', regionId: 'region-1' },
      facilities: [{ id: 'facility-active' }, { id: 'facility-historic' }],
    });
    expect(municipalityFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'municipality-inactive',
        OR: [
          { active: true },
          { attentions: { some: { year: 2025, month: 12, status: 'ACTIVO' } } },
        ],
      },
      select: expect.objectContaining({
        facilities: {
          where: {
            OR: [
              { active: true },
              { attentions: { some: { year: 2025, month: 12, status: 'ACTIVO' } } },
            ],
          },
          orderBy: [{ code: 'asc' }, { id: 'asc' }],
          select: { id: true, code: true, name: true },
        },
      }),
    });
  });

  it('returns undefined when an inactive municipality has no active ITS-1 history in the period', async () => {
    municipalityFindFirst.mockResolvedValue(null);
    await expect(
      repository.getPreliminaryReportSource({
        municipalityId: 'municipality-inactive',
        year: 2025,
        month: 11,
      }),
    ).resolves.toBeUndefined();
  });
});
