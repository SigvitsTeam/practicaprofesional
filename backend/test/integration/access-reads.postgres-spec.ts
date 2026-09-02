import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  type Prisma,
  type AppUser,
  type UserTerritorialAssignment,
} from '../../src/generated/prisma/client';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { RoleCode } from '../../src/modules/authorization/domain/authorization.types';
import { PrismaIdentityRepository } from '../../src/modules/authorization/infrastructure/prisma-identity.repository';
import { PrismaManagedUserRepository } from '../../src/modules/user-admin/infrastructure/prisma-managed-user.repository';
import { requireQaDatabaseUrl } from './qa-database';

describe('Optimized access reads (isolated PostgreSQL)', () => {
  const url = requireQaDatabaseUrl(process.env.QA_DATABASE_URL);
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url.href, max: 4 }),
    log: [{ emit: 'event', level: 'query' }],
  });
  const service = { client } as unknown as PrismaService;
  const identity = new PrismaIdentityRepository(service);
  const users = new PrismaManagedUserRepository(service);
  const marker = `QA-A-${randomUUID().slice(0, 8)}`;
  const issuer = `https://example.invalid/${marker}`;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const day = (offset: number): Date => new Date(today.getTime() + offset * 86_400_000);
  const ownedUserIds: string[] = [];
  const regionIds: string[] = [];
  const municipalityIds: string[] = [];
  const facilityIds: string[] = [];
  const permissionIds: string[] = [];
  let queryCount = 0;
  let userId: string;
  let superRoleId: string;
  let unknownRoleId: string;
  client.$on('query', () => queryCount++);

  async function createUser(active = true): Promise<AppUser> {
    const id = randomUUID();
    const user = await client.appUser.create({
      data: {
        id,
        fullName: `${marker}-${ownedUserIds.length}`,
        email: `${id}@example.invalid`,
        active,
        externalIdentities: { create: { issuer, subject: id } },
        roles: { create: { roleId: superRoleId, startDate: day(-30) } },
      },
    });
    ownedUserIds.push(id);
    return user;
  }

  function assign(
    data: Omit<Prisma.UserTerritorialAssignmentUncheckedCreateInput, 'userId' | 'startDate'> & {
      userId?: string;
      startDate?: Date;
    },
  ): Promise<UserTerritorialAssignment> {
    return client.userTerritorialAssignment.create({
      data: { userId, startDate: day(-30), ...data },
    });
  }

  beforeAll(async () => {
    superRoleId = (await client.role.findUniqueOrThrow({ where: { code: RoleCode.SuperAdmin } }))
      .id;
    unknownRoleId = (
      await client.role.create({
        data: { code: marker, name: marker, hierarchyLevel: 99 },
      })
    ).id;
    for (let i = 0; i < 2; i++) {
      const region = await client.region.create({
        data: { code: `${marker}-r${i}`, name: `${marker}-r${i}`, type: 'SANITARIA' },
      });
      regionIds.push(region.id);
    }
    // Municipality 1 is inactive; municipality 2 belongs to another region.
    for (let i = 0; i < 3; i++) {
      const municipality = await client.municipality.create({
        data: {
          regionId: regionIds[i === 2 ? 1 : 0]!,
          officialCode: `${marker}-m${i}`,
          name: `${marker}-m${i}`,
          active: i !== 1,
        },
      });
      municipalityIds.push(municipality.id);
    }
    // Active siblings 0/1, inactive sibling 2, inactive parent 3, other region 4.
    for (let i = 0; i < 5; i++) {
      const facility = await client.healthFacility.create({
        data: {
          municipalityId: municipalityIds[i < 3 ? 0 : i - 2]!,
          code: `${marker}-f${i}`,
          name: `${marker}-f${i}`,
          type: 'CIS',
          active: i !== 2,
        },
      });
      facilityIds.push(facility.id);
    }
    for (const active of [true, false]) {
      const permission = await client.permission.create({
        data: { code: `${marker}:${active}`, module: marker, action: 'read', active },
      });
      permissionIds.push(permission.id);
      await client.rolePermission.createMany({
        data: [superRoleId, unknownRoleId].map((roleId) => ({
          roleId,
          permissionId: permission.id,
        })),
      });
    }
  });

  beforeEach(async () => {
    userId = (await createUser()).id;
  });

  afterEach(async () => {
    await client.userTerritorialAssignment.deleteMany({ where: { userId: { in: ownedUserIds } } });
    await client.userRole.deleteMany({ where: { userId: { in: ownedUserIds } } });
    await client.externalIdentity.deleteMany({ where: { userId: { in: ownedUserIds } } });
    await client.appUser.deleteMany({ where: { id: { in: ownedUserIds } } });
    ownedUserIds.length = 0;
  });

  afterAll(async () => {
    try {
      await client.rolePermission.deleteMany({ where: { permissionId: { in: permissionIds } } });
      await client.permission.deleteMany({ where: { id: { in: permissionIds } } });
      if (unknownRoleId) await client.role.delete({ where: { id: unknownRoleId } });
      await client.healthFacility.deleteMany({ where: { id: { in: facilityIds } } });
      await client.municipality.deleteMany({ where: { id: { in: municipalityIds } } });
      await client.region.deleteMany({ where: { id: { in: regionIds } } });
    } finally {
      await client.$disconnect();
    }
  });

  it('resolves national grants in exactly one SQL query', async () => {
    await assign({ scopeType: 'NACIONAL' });
    queryCount = 0;
    const result = await identity.findSubject(issuer, userId);
    expect(queryCount).toBe(1);
    expect(result).toMatchObject({
      userId,
      roles: [RoleCode.SuperAdmin],
      territory: { national: true, regionIds: [], municipalityIds: [], facilityIds: [] },
    });
  });

  it.each(Object.values(RoleCode))('preserves role %s', async (code) => {
    const role = await client.role.findUniqueOrThrow({ where: { code } });
    await client.userRole.updateMany({ where: { userId }, data: { roleId: role.id } });
    expect((await identity.findSubject(issuer, userId))?.roles).toEqual([code]);
  });

  it('expands region grants only to active descendants', async () => {
    await assign({ scopeType: 'REGION', regionId: regionIds[0]! });
    const territory = (await identity.findSubject(issuer, userId))!.territory;
    expect(territory.national).toBe(false);
    expect(territory.regionIds).toEqual([regionIds[0]]);
    expect(territory.municipalityIds).toEqual([municipalityIds[0]]);
    expect([...territory.facilityIds].sort()).toEqual(facilityIds.slice(0, 2).sort());
  });

  it('expands a municipal grant without granting another region', async () => {
    await assign({ scopeType: 'MUNICIPIO', municipalityId: municipalityIds[0]! });
    const territory = (await identity.findSubject(issuer, userId))!.territory;
    expect(territory.regionIds).toEqual([regionIds[0]]);
    expect(territory.municipalityIds).toEqual([municipalityIds[0]]);
    expect([...territory.facilityIds].sort()).toEqual(facilityIds.slice(0, 2).sort());
  });

  it.each([0, 2])('keeps direct facility %s without granting siblings', async (index) => {
    await assign({ scopeType: 'ESTABLECIMIENTO', facilityId: facilityIds[index]! });
    expect((await identity.findSubject(issuer, userId))?.territory).toEqual({
      national: false,
      regionIds: [regionIds[0]],
      municipalityIds: [municipalityIds[0]],
      facilityIds: [facilityIds[index]],
    });
  });

  it('preserves explicit inactive municipality grants without implicit regional expansion', async () => {
    await assign({ scopeType: 'MUNICIPIO', municipalityId: municipalityIds[1]! });
    expect((await identity.findSubject(issuer, userId))?.territory.facilityIds).toEqual([
      facilityIds[3],
    ]);
  });

  it('deduplicates overlapping grants and active permissions, excluding unknown role codes', async () => {
    await assign({ scopeType: 'REGION', regionId: regionIds[0]! });
    await assign({ scopeType: 'MUNICIPIO', municipalityId: municipalityIds[0]! });
    await assign({ scopeType: 'ESTABLECIMIENTO', facilityId: facilityIds[0]! });
    await client.userRole.create({ data: { userId, roleId: unknownRoleId, startDate: day(-1) } });
    const result = (await identity.findSubject(issuer, userId))!;
    expect(result.roles).toEqual([RoleCode.SuperAdmin]);
    expect(result.permissions.filter((p) => p.startsWith(marker))).toEqual([`${marker}:true`]);
    expect(result.territory.facilityIds).toHaveLength(2);
  });

  it.each([
    { name: 'inactive', active: false, startDate: day(-2), endDate: null },
    { name: 'expired', active: true, startDate: day(-2), endDate: day(-1) },
    { name: 'future', active: true, startDate: day(1), endDate: null },
  ])('excludes $name role and territorial assignments', async ({ active, startDate, endDate }) => {
    const validity = { active, startDate, endDate };
    await client.userRole.updateMany({ where: { userId }, data: validity });
    await assign({ scopeType: 'NACIONAL', ...validity });
    const result = (await identity.findSubject(issuer, userId))!;
    expect(result.roles).toEqual([]);
    expect(result.permissions).toEqual([]);
    expect(result.territory.national).toBe(false);
    expect((await users.list()).some((user) => user.id === userId)).toBe(false);
  });

  it('includes both UTC date boundaries', async () => {
    await client.userRole.updateMany({
      where: { userId },
      data: { startDate: today, endDate: today },
    });
    await assign({ scopeType: 'NACIONAL', startDate: today, endDate: today });
    expect((await identity.findSubject(issuer, userId))?.roles).toEqual([RoleCode.SuperAdmin]);
    expect((await identity.findSubject(issuer, userId))?.territory.national).toBe(true);
    expect((await users.list()).some((user) => user.id === userId)).toBe(true);
  });

  it('observes permission revocation and user suspension on the next read', async () => {
    await assign({ scopeType: 'NACIONAL' });
    expect((await identity.findSubject(issuer, userId))?.territory.national).toBe(true);
    await client.userRole.updateMany({ where: { userId }, data: { active: false } });
    await client.userTerritorialAssignment.updateMany({
      where: { userId },
      data: { active: false },
    });
    const revoked = (await identity.findSubject(issuer, userId))!;
    expect(revoked.roles).toEqual([]);
    expect(revoked.permissions).toEqual([]);
    expect(revoked.territory.national).toBe(false);
    await client.appUser.update({ where: { id: userId }, data: { active: false } });
    expect(await identity.findSubject(issuer, userId)).toBeNull();
  });

  it('requires an exact issuer/subject match and parameterizes untrusted values', async () => {
    expect(await identity.findSubject(issuer, "' OR TRUE --")).toBeNull();
    expect(await identity.findSubject("' OR TRUE --", userId)).toBeNull();
    expect(await identity.findSubject(issuer, randomUUID())).toBeNull();
  });

  it('lists the same public user shape in one SQL query without exposing external identities', async () => {
    await assign({ scopeType: 'NACIONAL' });
    queryCount = 0;
    const result = (await users.list()).find((user) => user.id === userId)!;
    expect(queryCount).toBe(1);
    expect(result).toMatchObject({
      id: userId,
      active: true,
      hasExternalIdentity: true,
      role: { code: RoleCode.SuperAdmin, startDate: day(-30) },
      assignment: {
        scopeType: 'NACIONAL',
        regionId: null,
        municipalityId: null,
        facilityId: null,
        label: 'Honduras',
        startDate: day(-30),
      },
    });
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
    expect(result).not.toHaveProperty('externalIdentities');
  });

  it('keeps suspended/unlinked profiles visible to administrators', async () => {
    await assign({ scopeType: 'NACIONAL' });
    await client.appUser.update({ where: { id: userId }, data: { active: false } });
    await client.externalIdentity.deleteMany({ where: { userId } });
    expect((await users.list()).find((user) => user.id === userId)).toMatchObject({
      active: false,
      hasExternalIdentity: false,
    });
  });

  it.each(['REGION', 'MUNICIPIO', 'ESTABLECIMIENTO'] as const)(
    'filters %s assignments by the authorized region',
    async (scopeType) => {
      await assign({
        scopeType,
        regionId: scopeType === 'REGION' ? regionIds[0]! : null,
        municipalityId: scopeType === 'MUNICIPIO' ? municipalityIds[0]! : null,
        facilityId: scopeType === 'ESTABLECIMIENTO' ? facilityIds[0]! : null,
      });
      expect((await users.list([regionIds[0]!])).some((user) => user.id === userId)).toBe(true);
      expect((await users.list([regionIds[1]!])).some((user) => user.id === userId)).toBe(false);
    },
  );

  it('never returns a newer out-of-scope assignment to a regional administrator', async () => {
    await assign({ scopeType: 'REGION', regionId: regionIds[0]! });
    await assign({ scopeType: 'REGION', regionId: regionIds[1]!, startDate: day(-1) });
    expect((await users.list()).find((user) => user.id === userId)?.assignment.regionId).toBe(
      regionIds[1],
    );
    expect(
      (await users.list([regionIds[0]!])).find((user) => user.id === userId)?.assignment.regionId,
    ).toBe(regionIds[0]);
    expect(
      (await users.list([regionIds[0]!, regionIds[1]!])).find((user) => user.id === userId)
        ?.assignment.regionId,
    ).toBe(regionIds[1]);
  });

  it('returns no users and performs no SQL for an empty authorized region set', async () => {
    await assign({ scopeType: 'NACIONAL' });
    queryCount = 0;
    expect(await users.list([])).toEqual([]);
    expect(queryCount).toBe(0);
  });

  it('excludes incomplete profiles and selects the latest current role deterministically', async () => {
    expect((await users.list()).some((user) => user.id === userId)).toBe(false);
    await assign({ scopeType: 'NACIONAL' });
    const role = await client.role.findUniqueOrThrow({ where: { code: RoleCode.CentralAdmin } });
    await client.userRole.create({ data: { userId, roleId: role.id, startDate: day(-1) } });
    expect((await users.list()).find((user) => user.id === userId)?.role.code).toBe(
      RoleCode.CentralAdmin,
    );
    await client.userRole.deleteMany({ where: { userId } });
    expect((await users.list()).some((user) => user.id === userId)).toBe(false);
  });
});
