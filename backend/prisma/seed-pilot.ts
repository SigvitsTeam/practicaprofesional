import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const facilities = [
  ['2721', 'Policlínico Cornelio Moncada Puerto Cortés', 'POLICLINICO'],
  ['85481', 'CIS Linda Coello', 'CIS'],
  ['2771', 'UAPS La Pita', 'UAPS'],
  ['2739', 'CIS Bajamar', 'CIS'],
  ['82899', 'UAPS Travesia', 'UAPS'],
  ['82881', 'UAPS Saraguayna', 'UAPS'],
  ['83453', 'CIS Fraternidad', 'CIS'],
  ['2747', 'CIS Baracoa', 'CIS'],
  ['9563', 'UAPS Calan', 'UAPS'],
  ['2780', 'UAPS Puente Alto', 'UAPS'],
  ['2755', 'UAPS Caoba', 'UAPS'],
  ['2763', 'UAPS Kele Kele', 'UAPS'],
] as const;

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`La variable ${name} es obligatoria.`);
  return value;
}

async function seed(): Promise<void> {
  const adapter = new PrismaPg({ connectionString: requiredEnvironment('DIRECT_URL') });
  const prisma = new PrismaClient({ adapter });
  try {
    await prisma.$transaction(async (transaction) => {
      const program = await transaction.healthProgram.upsert({
        where: { code: 'ITS' },
        update: { name: 'Infecciones de Transmisión Sexual', active: true },
        create: { code: 'ITS', name: 'Infecciones de Transmisión Sexual' },
      });
      const region = await transaction.region.upsert({
        where: { code: 'CORTES' },
        update: { name: 'Región Sanitaria Departamental de Cortés', active: true },
        create: {
          code: 'CORTES',
          name: 'Región Sanitaria Departamental de Cortés',
          type: 'DEPARTAMENTAL',
          operationalStatus: 'EN_PILOTAJE',
        },
      });
      const municipality = await transaction.municipality.upsert({
        where: { officialCode: '0506' },
        update: { regionId: region.id, name: 'Puerto Cortés', active: true },
        create: {
          regionId: region.id,
          officialCode: '0506',
          name: 'Puerto Cortés',
          operationalStatus: 'EN_PILOTAJE',
          mapValidated: false,
        },
      });

      for (const [code, name, type] of facilities) {
        await transaction.healthFacility.upsert({
          where: { code },
          update: { municipalityId: municipality.id, name, type, active: true },
          create: {
            municipalityId: municipality.id,
            code,
            name,
            type,
            operationalStatus: 'EN_PILOTAJE',
            coordinatesValidated: false,
          },
        });
      }

      for (const [code, name, order] of [
        ['SINDROMICO', 'Sindrómico', 1],
        ['CLINICO', 'Clínico', 2],
        ['CE', 'C/E', 3],
        ['ETIOLOGICO', 'Etiológico', 4],
      ] as const) {
        await transaction.itsClassification.upsert({
          where: { programId_code: { programId: program.id, code } },
          update: { name, order, active: true },
          create: { programId: program.id, code, name, order },
        });
      }

      for (const [code, name] of [
        ['GENERAL', 'General'],
        ['TRABAJADOR_SEXUAL', 'Trabajador(a) sexual'],
      ] as const) {
        await transaction.populationType.upsert({
          where: { code },
          update: { name, active: true },
          create: { code, name },
        });
      }

      for (const group of [
        {
          code: 'MENOR_15',
          name: 'Menor de 15 años',
          minimumAge: 0,
          maximumAge: 14,
          formatOrder: 1,
        },
        {
          code: 'MAYOR_IGUAL_15',
          name: 'Mayor o igual de 15 años',
          minimumAge: 15,
          maximumAge: 120,
          formatOrder: 2,
        },
      ]) {
        await transaction.ageGroup.upsert({
          where: { code: group.code },
          update: { ...group, active: true },
          create: group,
        });
        await transaction.comparativeAgeGroup.upsert({
          where: { code: group.code },
          update: {
            name: group.name,
            minimumAge: group.minimumAge,
            maximumAge: group.maximumAge,
            active: true,
          },
          create: {
            code: group.code,
            name: group.name,
            minimumAge: group.minimumAge,
            maximumAge: group.maximumAge,
            definition: `${group.minimumAge} a ${group.maximumAge} años para el piloto.`,
          },
        });
      }
    });
    process.stdout.write(
      `${JSON.stringify({ program: 'ITS', region: 'CORTES', municipality: '0506', facilities: facilities.length })}\n`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

seed().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Error desconocido'}\n`);
  process.exitCode = 1;
});
