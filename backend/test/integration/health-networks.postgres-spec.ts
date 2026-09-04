import { randomUUID } from 'node:crypto';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { PrismaHealthNetworkRepository } from '../../src/modules/territorial/infrastructure/prisma-health-network.repository';
import { createQaClient } from './qa-database';
import { OperationalStatus } from '../../src/modules/territorial/domain/region';
import {
  HealthNetworkConflictError,
  type HealthNetworkSummary,
} from '../../src/modules/territorial/domain/health-network';

describe('Scoped historical networks (isolated PostgreSQL)', () => {
  const client = createQaClient();
  const repository = new PrismaHealthNetworkRepository({ client } as unknown as PrismaService);
  const marker = `QA-N-${randomUUID().slice(0, 8)}`;
  const regionId = randomUUID();
  const municipalityIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const networkIds: string[] = [randomUUID(), randomUUID(), randomUUID()];
  const actorUserId = randomUUID();
  const date = (value: string): Date => new Date(`${value}T00:00:00Z`);
  const list = (
    asOf: string,
    municipalityIds: string[],
    regionGrantIds: string[] = [],
  ): Promise<HealthNetworkSummary[]> =>
    repository.list({
      national: false,
      regionGrantIds,
      municipalityIds,
      asOf: date(asOf),
    });

  beforeAll(async () => {
    await client.appUser.create({
      data: { id: actorUserId, fullName: marker, email: `${marker}@example.invalid` },
    });
    await client.region.create({
      data: { id: regionId, code: marker, name: marker, type: 'SANITARIA' },
    });
    for (const [i, id] of municipalityIds.entries())
      await client.municipality.create({
        data: { id, regionId, officialCode: `${marker}-M${i}`, name: `${marker}-M${i}` },
      });
    for (const [i, id] of networkIds.entries())
      await client.healthNetwork.create({
        data: {
          id,
          regionId,
          code: `${marker}-N${i}`,
          name: `${marker}-N${i}`,
          startDate: date('2026-07-01'),
        },
      });
    await client.networkMunicipality.createMany({
      data: [
        // M0 moved from N0 to N1 on August 25; N0 retains its closed history.
        {
          networkId: networkIds[0]!,
          municipalityId: municipalityIds[0]!,
          startDate: date('2026-07-01'),
          endDate: date('2026-08-25'),
          active: false,
        },
        {
          networkId: networkIds[1]!,
          municipalityId: municipalityIds[0]!,
          startDate: date('2026-08-25'),
        },
        {
          networkId: networkIds[1]!,
          municipalityId: municipalityIds[1]!,
          startDate: date('2026-07-01'),
        },
        {
          networkId: networkIds[2]!,
          municipalityId: municipalityIds[2]!,
          startDate: date('2026-07-01'),
        },
      ],
    });
  });

  afterAll(async () => {
    try {
      await client.auditEvent.deleteMany({ where: { entityId: { in: networkIds } } });
      await client.networkMunicipality.deleteMany({ where: { networkId: { in: networkIds } } });
      await client.healthNetwork.deleteMany({ where: { id: { in: networkIds } } });
      await client.municipality.deleteMany({ where: { id: { in: municipalityIds } } });
      await client.region.deleteMany({ where: { id: regionId } });
      await client.appUser.deleteMany({ where: { id: actorUserId } });
    } finally {
      await client.$disconnect();
    }
  });

  it('recovers a closed membership for a historical month instead of reading today', async () => {
    const rows = await list('2026-07-31', [municipalityIds[0]!]);
    expect(rows.map(({ id }) => id)).toEqual([networkIds[0]]);
    expect(rows[0]?.municipalities.map(({ id }) => id)).toEqual([municipalityIds[0]]);
  });

  it.each(['2026-08-25', '2026-08-31'])(
    'does not count the previous network on or after transfer %s',
    async (cut) => {
      const rows = await list(cut, [municipalityIds[0]!]);
      expect(rows.map(({ id }) => id)).toEqual([networkIds[1]]);
      expect(rows[0]?.municipalities.map(({ id }) => id)).toEqual([municipalityIds[0]]);
      expect(rows[0]?.scopeLimited).toBe(true);
    },
  );

  it('does not expose another member or another network from the same parent region', async () => {
    const rows = await list('2026-08-31', [municipalityIds[0]!]);
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toContain(municipalityIds[1]);
    expect(serialized).not.toContain(municipalityIds[2]);
    expect(serialized).not.toContain(networkIds[2]);
  });

  it('allows complete composition and empty networks only with a direct regional grant', async () => {
    const rows = await list('2026-08-31', [], [regionId]);
    expect(rows).toHaveLength(3);
    expect(rows.find(({ id }) => id === networkIds[0])?.municipalities).toEqual([]);
    expect(rows.find(({ id }) => id === networkIds[1])?.municipalities).toHaveLength(2);
    expect(rows.every(({ scopeLimited }) => scopeLimited === false)).toBe(true);
  });

  it('returns no networks before their start or without authorized territories', async () => {
    expect(await list('2026-06-30', [], [regionId])).toEqual([]);
    expect(await list('2026-08-31', [])).toEqual([]);
  });

  it('grants municipal coordination read only, without network mutation privileges', async () => {
    const role = await client.role.findUniqueOrThrow({
      where: { code: 'COORDINADOR_MUNICIPAL' },
      include: { rolePermissions: { include: { permission: true } } },
    });
    expect(
      role.rolePermissions
        .map(({ permission }) => permission.code)
        .filter((code) => code.startsWith('territorial:networks:')),
    ).toEqual(['territorial:networks:read']);
  });

  const create = (code: string, municipalityId: string): Promise<HealthNetworkSummary> =>
    repository.create({
      regionId,
      code: `${marker}-${code}`,
      name: `${marker}-${code}`,
      description: null,
      operationalStatus: OperationalStatus.InPilot,
      startDate: date('2026-08-25'),
      municipalityIds: [municipalityId],
      audit: { actorUserId, requestId: randomUUID(), reason: 'Alta sintética aislada de QA' },
    });

  it('rejects overlapping memberships across networks without writing a new network', async () => {
    await expect(create('conflict', municipalityIds[0]!)).rejects.toBeInstanceOf(
      HealthNetworkConflictError,
    );
    expect(await client.healthNetwork.count({ where: { regionId } })).toBe(3);
  });

  it('permits only one winner when two networks concurrently claim the same municipality', async () => {
    const results = await Promise.allSettled([
      create('race-a', municipalityIds[3]!),
      create('race-b', municipalityIds[3]!),
    ]);
    for (const result of results)
      if (result.status === 'fulfilled') networkIds.push(result.value.id);
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    expect(
      await client.networkMunicipality.count({ where: { municipalityId: municipalityIds[3] } }),
    ).toBe(1);
  });
});
