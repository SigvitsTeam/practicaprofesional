import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type TerritorialScopeType } from '../src/generated/prisma/client';

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`La variable ${name} es obligatoria.`);
  return value;
}

async function provision(): Promise<void> {
  const databaseUrl = process.env.DIRECT_URL?.trim() || requiredEnvironment('DATABASE_URL');
  const issuer = process.env.PROVISION_USER_ISSUER?.trim() || requiredEnvironment('AUTH_ISSUER');
  const subject = requiredEnvironment('PROVISION_USER_SUBJECT');
  const email = requiredEnvironment('PROVISION_USER_EMAIL').toLowerCase();
  const fullName = requiredEnvironment('PROVISION_USER_NAME');
  const roleCode = requiredEnvironment('PROVISION_USER_ROLE').toUpperCase();
  const scopeType = requiredEnvironment(
    'PROVISION_SCOPE_TYPE',
  ).toUpperCase() as TerritorialScopeType;
  const scopeCode = process.env.PROVISION_SCOPE_CODE?.trim();
  const actorEmail = (
    process.env.PROVISION_ACTOR_EMAIL?.trim() || requiredEnvironment('BOOTSTRAP_ADMIN_EMAIL')
  ).toLowerCase();
  if (!['NACIONAL', 'REGION', 'MUNICIPIO', 'ESTABLECIMIENTO'].includes(scopeType))
    throw new Error(`Tipo de alcance no válido: ${scopeType}.`);
  if (scopeType !== 'NACIONAL' && !scopeCode)
    throw new Error('PROVISION_SCOPE_CODE es obligatorio para un alcance territorial.');

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    const [actor, role, existingIdentity, existingEmail] = await Promise.all([
      prisma.appUser.findFirst({
        where: { email: actorEmail, active: true },
        select: { id: true },
      }),
      prisma.role.findFirst({ where: { code: roleCode, active: true }, select: { id: true } }),
      prisma.externalIdentity.findUnique({
        where: { issuer_subject: { issuer, subject } },
        select: { userId: true },
      }),
      prisma.appUser.findUnique({ where: { email }, select: { id: true } }),
    ]);
    if (!actor) throw new Error('El actor de aprovisionamiento no existe o está inactivo.');
    if (!role) throw new Error(`El rol ${roleCode} no existe o está inactivo.`);
    if (existingIdentity && existingEmail && existingIdentity.userId !== existingEmail.id)
      throw new Error('La identidad externa y el correo pertenecen a usuarios distintos.');

    const territory = {
      regionId: undefined as string | undefined,
      municipalityId: undefined as string | undefined,
      facilityId: undefined as string | undefined,
    };
    if (scopeType === 'REGION') {
      const region = await prisma.region.findUnique({
        where: { code: scopeCode! },
        select: { id: true },
      });
      if (!region) throw new Error(`No existe la región ${scopeCode}.`);
      territory.regionId = region.id;
    } else if (scopeType === 'MUNICIPIO') {
      const municipality = await prisma.municipality.findUnique({
        where: { officialCode: scopeCode! },
        select: { id: true },
      });
      if (!municipality) throw new Error(`No existe el municipio ${scopeCode}.`);
      territory.municipalityId = municipality.id;
    } else if (scopeType === 'ESTABLECIMIENTO') {
      const facility = await prisma.healthFacility.findUnique({
        where: { code: scopeCode! },
        select: { id: true },
      });
      if (!facility) throw new Error(`No existe el establecimiento ${scopeCode}.`);
      territory.facilityId = facility.id;
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const user = await prisma.$transaction(async (transaction) => {
      const provisioned = await transaction.appUser.upsert({
        where: { email },
        update: { fullName, active: true },
        create: { fullName, email },
        select: { id: true },
      });
      await transaction.externalIdentity.upsert({
        where: { issuer_subject: { issuer, subject } },
        update: { emailSnapshot: email },
        create: { userId: provisioned.id, issuer, subject, emailSnapshot: email },
      });
      const currentRole = await transaction.userRole.findFirst({
        where: { userId: provisioned.id, roleId: role.id, active: true, endDate: null },
      });
      if (!currentRole)
        await transaction.userRole.create({
          data: { userId: provisioned.id, roleId: role.id, startDate: today },
        });
      const currentAssignment = await transaction.userTerritorialAssignment.findFirst({
        where: {
          userId: provisioned.id,
          scopeType,
          regionId: territory.regionId ?? null,
          municipalityId: territory.municipalityId ?? null,
          facilityId: territory.facilityId ?? null,
          active: true,
          endDate: null,
        },
      });
      if (!currentAssignment)
        await transaction.userTerritorialAssignment.create({
          data: { userId: provisioned.id, scopeType, ...territory, startDate: today },
        });
      await transaction.auditEvent.create({
        data: {
          actorUserId: actor.id,
          action: 'USUARIO_INSTITUCIONAL_APROVISIONADO',
          entity: 'usuarios',
          entityId: provisioned.id,
          dataLevel: 'CONFIGURACION',
          reason: 'Aprovisionamiento controlado de identidad, rol y territorio.',
          newData: { email, issuer, roleCode, scopeType, scopeCode: scopeCode ?? null },
        },
      });
      return provisioned;
    });
    process.stdout.write(
      `${JSON.stringify({ userId: user.id, email, roleCode, scopeType, scopeCode })}\n`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

provision().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Error desconocido'}\n`);
  process.exitCode = 1;
});
