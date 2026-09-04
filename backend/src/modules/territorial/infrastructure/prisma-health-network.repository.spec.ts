import type { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PrismaHealthNetworkRepository } from './prisma-health-network.repository';

describe('Network read isolation and historical composition', () => {
  const asOf = new Date('2026-08-31T00:00:00Z');
  const row = {
    id: 'network-1',
    regionId: 'region-1',
    region: { name: 'Cortés' },
    code: 'R1',
    name: 'Red QA',
    active: true,
    startDate: asOf,
    updatedAt: asOf,
    memberships: ['municipality-1', 'municipality-2'].map((id) => ({
      municipalityId: id,
      municipality: { id, officialCode: id, name: id },
      startDate: asOf,
    })),
  };
  const findMany = jest.fn();
  const repository = new PrismaHealthNetworkRepository({
    client: { healthNetwork: { findMany } },
  } as unknown as PrismaService);
  beforeEach(() => {
    findMany.mockReset().mockResolvedValue([row]);
  });

  it('fails closed without any actual grants', async () => {
    expect(
      await repository.list({ national: false, regionGrantIds: [], municipalityIds: [], asOf }),
    ).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('restricts network selection and returned member identifiers for municipal readers', async () => {
    const [result] = await repository.list({
      national: false,
      regionGrantIds: [],
      municipalityIds: ['municipality-1'],
      asOf,
    });
    expect(result?.municipalities.map(({ id }) => id)).toEqual(['municipality-1']);
    expect(result).toMatchObject({ scopeLimited: true, membershipAsOf: asOf });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          startDate: { lte: asOf },
          OR: [
            { regionId: { in: [] } },
            {
              memberships: {
                some: expect.objectContaining({ municipalityId: { in: ['municipality-1'] } }),
              },
            },
          ],
        },
      }),
    );
  });

  it('keeps complete memberships for explicit regional grants', async () => {
    const [result] = await repository.list({
      national: false,
      regionGrantIds: ['region-1'],
      municipalityIds: [],
      asOf,
    });
    expect(result?.municipalities).toHaveLength(2);
    expect(result?.scopeLimited).toBe(false);
  });

  it('uses civil dates and includes closed historical memberships until the exclusive end', async () => {
    await repository.list({ national: true, regionGrantIds: [], municipalityIds: [], asOf });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          memberships: expect.objectContaining({
            where: {
              programId: null,
              startDate: { lte: asOf },
              OR: [{ active: true, endDate: null }, { endDate: { gt: asOf } }],
            },
          }),
        }),
      }),
    );
  });
});
