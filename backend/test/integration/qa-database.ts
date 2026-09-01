import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';

export function requireQaDatabaseUrl(value: string | undefined): URL {
  if (!value)
    throw new Error('QA_DATABASE_URL explícita es obligatoria; no se usan URLs institucionales.');
  const url = new URL(value);
  if (!['postgresql:', 'postgres:'].includes(url.protocol))
    throw new Error('QA_DATABASE_URL debe utilizar PostgreSQL.');
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
    throw new Error('QA_DATABASE_URL debe apuntar exclusivamente a loopback.');
  if (!/^\/sigvits_qa[a-z0-9_]*$/i.test(url.pathname))
    throw new Error('La base de QA debe tener el prefijo sigvits_qa.');
  // Query parameters can override host/database in a PostgreSQL connection
  // string. Reject them, including options, instead of trusting the visible host.
  if (url.search || url.hash)
    throw new Error('QA_DATABASE_URL no admite parámetros ni fragmentos.');
  return url;
}

export function createQaClient(): PrismaClient {
  const url = requireQaDatabaseUrl(process.env.QA_DATABASE_URL);
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: url.href, max: 6, connectionTimeoutMillis: 5_000 }),
  });
}

export interface QaFixture {
  userId: string;
  programId: string;
  ownsProgram: boolean;
  regionId: string;
  municipalityId: string;
  classificationId: string;
  diseaseId: string;
  ageGroupId: string;
  comparativeAgeGroupId: string;
  populationTypeId: string;
  weekId: string;
  periodId: string;
  year: number;
  month: number;
  date: Date;
}

export async function createQaFixture(client: PrismaClient): Promise<QaFixture> {
  const marker = `QA-${randomUUID().slice(0, 8)}`;
  const year = 2099;
  const month = 8;
  const date = new Date(`${year}-08-15T00:00:00.000Z`);
  return client.$transaction(async (tx) => {
    const existingProgram = await tx.healthProgram.findUnique({ where: { code: 'ITS' } });
    const program =
      existingProgram ??
      (await tx.healthProgram.create({
        data: { code: 'ITS', name: 'ITS QA sintético' },
      }));
    const user = await tx.appUser.create({
      data: { fullName: marker, email: `${marker.toLowerCase()}@example.invalid` },
    });
    const region = await tx.region.create({
      data: { code: marker, name: marker, type: 'SANITARIA' },
    });
    const municipality = await tx.municipality.create({
      data: { regionId: region.id, officialCode: marker, name: marker },
    });
    const classification = await tx.itsClassification.create({
      data: { programId: program.id, code: marker, name: marker, order: 1 },
    });
    const disease = await tx.itsDisease.create({
      data: { classificationId: classification.id, code: marker, name: marker, formatOrder: 1 },
    });
    const age = await tx.ageGroup.create({
      data: { code: marker, name: marker, minimumAge: 15, maximumAge: 120, formatOrder: 1 },
    });
    const comparativeAge = await tx.comparativeAgeGroup.create({
      data: { code: marker, name: marker, minimumAge: 15, maximumAge: 120, definition: 'Solo QA' },
    });
    const population = await tx.populationType.create({ data: { code: marker, name: marker } });
    const week = await tx.epidemiologicalWeek.create({
      data: { year, weekNumber: 33, startDate: date, endDate: date },
    });
    const period = await tx.reportingPeriod.create({
      data: {
        type: 'MENSUAL',
        year,
        month,
        status: 'ABIERTO',
        startDate: new Date(`${year}-08-01T00:00:00.000Z`),
        endDate: new Date(`${year}-08-31T00:00:00.000Z`),
      },
    });
    return {
      userId: user.id,
      programId: program.id,
      ownsProgram: !existingProgram,
      regionId: region.id,
      municipalityId: municipality.id,
      classificationId: classification.id,
      diseaseId: disease.id,
      ageGroupId: age.id,
      comparativeAgeGroupId: comparativeAge.id,
      populationTypeId: population.id,
      weekId: week.id,
      periodId: period.id,
      year,
      month,
      date,
    };
  });
}

export async function deleteQaFixture(client: PrismaClient, fixture: QaFixture): Promise<void> {
  // Exact ownership predicates only: never reset the schema or truncate tables.
  await client.$transaction(async (tx) => {
    await tx.itsReport.deleteMany({ where: { generatedById: fixture.userId } });
    await tx.itsAttention.deleteMany({ where: { registeredById: fixture.userId } });
    await tx.auditEvent.deleteMany({ where: { actorUserId: fixture.userId } });
    await tx.healthFacility.deleteMany({ where: { municipalityId: fixture.municipalityId } });
    await tx.municipality.delete({ where: { id: fixture.municipalityId } });
    await tx.region.delete({ where: { id: fixture.regionId } });
    await tx.itsDisease.delete({ where: { id: fixture.diseaseId } });
    await tx.itsClassification.delete({ where: { id: fixture.classificationId } });
    await tx.ageGroup.delete({ where: { id: fixture.ageGroupId } });
    await tx.comparativeAgeGroup.delete({ where: { id: fixture.comparativeAgeGroupId } });
    await tx.populationType.delete({ where: { id: fixture.populationTypeId } });
    await tx.reportingPeriod.delete({ where: { id: fixture.periodId } });
    await tx.epidemiologicalWeek.delete({ where: { id: fixture.weekId } });
    await tx.appUser.delete({ where: { id: fixture.userId } });
    if (fixture.ownsProgram) await tx.healthProgram.delete({ where: { id: fixture.programId } });
  });
}
