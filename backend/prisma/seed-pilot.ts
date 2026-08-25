import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

// Fuentes y nivel de confianza: docs/fuentes-geograficas-piloto.md.
// Solo las coordenadas puntuales publicadas para el establecimiento se marcan como validadas.
const facilities = [
  {
    code: '2721',
    name: 'Policlínico Cornelio Moncada Puerto Cortés',
    type: 'POLICLINICO',
    address: '9 calle, 2 avenida, barrio El Copen, Puerto Cortés',
    latitude: 15.8462772,
    longitude: -87.9364733,
    coordinatesValidated: false,
  },
  {
    code: '85481',
    name: 'CIS Linda Coello',
    type: 'CIS',
    address: 'Barrio Medina, Puerto Cortés',
    latitude: 15.8160232,
    longitude: -87.9129498,
    coordinatesValidated: false,
  },
  {
    code: '2771',
    name: 'UAPS La Pita',
    type: 'UAPS',
    address: 'Aldea La Pita, Puerto Cortés',
    latitude: 15.769564888,
    longitude: -87.947372698,
    coordinatesValidated: false,
  },
  {
    code: '2739',
    name: 'CIS Bajamar',
    type: 'CIS',
    address: 'Aldea Bajamar, Puerto Cortés',
    latitude: 15.885749,
    longitude: -87.85609268,
    coordinatesValidated: true,
  },
  {
    code: '82899',
    name: 'UAPS Travesia',
    type: 'UAPS',
    address: 'Aldea Travesía, Puerto Cortés',
    latitude: 15.862535103,
    longitude: -87.904676875,
    coordinatesValidated: false,
  },
  {
    code: '82881',
    name: 'UAPS Saraguayna',
    type: 'UAPS',
    address: 'Aldea Saraguayna, Puerto Cortés',
    latitude: 15.891829162,
    longitude: -87.76777793,
    coordinatesValidated: false,
  },
  {
    code: '83453',
    name: 'CIS Fraternidad',
    type: 'CIS',
    address: 'La Fraternidad, sector Chameleconcito, Puerto Cortés',
    latitude: 15.837070327,
    longitude: -87.861345817,
    coordinatesValidated: false,
  },
  {
    code: '2747',
    name: 'CIS Baracoa',
    type: 'CIS',
    address: 'Baracoa, Puerto Cortés',
    latitude: 15.773253,
    longitude: -87.852831,
    coordinatesValidated: true,
  },
  {
    code: '9563',
    name: 'UAPS Calan',
    type: 'UAPS',
    address: 'Aldea Calán, Puerto Cortés',
    latitude: 15.735520085,
    longitude: -87.828482112,
    coordinatesValidated: false,
  },
  {
    code: '2780',
    name: 'UAPS Puente Alto',
    type: 'UAPS',
    address: 'Aldea Puente Alto, Puerto Cortés',
    latitude: 15.755972077,
    longitude: -87.870722717,
    coordinatesValidated: false,
  },
  {
    code: '2755',
    name: 'UAPS Caoba',
    type: 'UAPS',
    address: 'Aldea La Caoba, Puerto Cortés',
    latitude: 15.73804076,
    longitude: -87.777696995,
    coordinatesValidated: false,
  },
  {
    code: '2763',
    name: 'UAPS Kele Kele',
    type: 'UAPS',
    address: 'Aldea Kele Kele, Puerto Cortés',
    latitude: 15.638708687,
    longitude: -87.782075496,
    coordinatesValidated: false,
  },
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

      for (const facility of facilities) {
        await transaction.healthFacility.upsert({
          where: { code: facility.code },
          update: {
            municipalityId: municipality.id,
            name: facility.name,
            type: facility.type,
            address: facility.address,
            latitude: facility.latitude,
            longitude: facility.longitude,
            coordinatesValidated: facility.coordinatesValidated,
            active: true,
          },
          create: {
            municipalityId: municipality.id,
            code: facility.code,
            name: facility.name,
            type: facility.type,
            address: facility.address,
            latitude: facility.latitude,
            longitude: facility.longitude,
            operationalStatus: 'EN_PILOTAJE',
            coordinatesValidated: facility.coordinatesValidated,
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

      const officialAgeGroups = [
        {
          code: 'MENOR_1',
          name: 'Menor de 1 año',
          minimumAge: 0,
          maximumAge: 0,
          formatOrder: 1,
        },
        {
          code: '1_4',
          name: '1 a 4 años',
          minimumAge: 1,
          maximumAge: 4,
          formatOrder: 2,
        },
        { code: '5_9', name: '5 a 9 años', minimumAge: 5, maximumAge: 9, formatOrder: 3 },
        { code: '10_14', name: '10 a 14 años', minimumAge: 10, maximumAge: 14, formatOrder: 4 },
        { code: '15_19', name: '15 a 19 años', minimumAge: 15, maximumAge: 19, formatOrder: 5 },
        { code: '20_24', name: '20 a 24 años', minimumAge: 20, maximumAge: 24, formatOrder: 6 },
        { code: '25_29', name: '25 a 29 años', minimumAge: 25, maximumAge: 29, formatOrder: 7 },
        { code: '30_49', name: '30 a 49 años', minimumAge: 30, maximumAge: 49, formatOrder: 8 },
        { code: '50_MAS', name: '50 años y más', minimumAge: 50, maximumAge: 120, formatOrder: 9 },
      ];
      await transaction.ageGroup.updateMany({
        where: { code: { notIn: officialAgeGroups.map((group) => group.code) } },
        data: { active: false },
      });
      for (const group of officialAgeGroups) {
        await transaction.ageGroup.upsert({
          where: { code: group.code },
          update: { ...group, active: true },
          create: group,
        });
      }

      for (const group of [
        { code: 'MENOR_15', name: 'Menor de 15 años', minimumAge: 0, maximumAge: 14 },
        {
          code: 'MAYOR_IGUAL_15',
          name: 'Mayor o igual de 15 años',
          minimumAge: 15,
          maximumAge: 120,
        },
      ]) {
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
            definition: `${group.minimumAge} a ${group.maximumAge} años para comparación epidemiológica.`,
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
