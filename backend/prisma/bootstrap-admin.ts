import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`La variable ${name} es obligatoria.`);
  return value;
}

async function bootstrap(): Promise<void> {
  const databaseUrl = process.env.DIRECT_URL?.trim() || requiredEnvironment('DATABASE_URL');
  const issuer = requiredEnvironment('BOOTSTRAP_ADMIN_ISSUER');
  const subject = requiredEnvironment('BOOTSTRAP_ADMIN_SUBJECT');
  const email = requiredEnvironment('BOOTSTRAP_ADMIN_EMAIL').toLowerCase();
  const fullName = requiredEnvironment('BOOTSTRAP_ADMIN_NAME');
  const configuredIssuer = process.env.AUTH_ISSUER?.trim();
  if (configuredIssuer && configuredIssuer !== issuer) {
    throw new Error('BOOTSTRAP_ADMIN_ISSUER debe coincidir con AUTH_ISSUER.');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    const userCount = await prisma.appUser.count();
    if (userCount !== 0) {
      throw new Error('Bootstrap rechazado: ya existe al menos un usuario institucional.');
    }

    const role = await prisma.role.findUnique({ where: { code: 'SUPERADMIN' } });
    if (!role?.active) throw new Error('El rol SUPERADMIN no existe o está inactivo.');

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    await prisma.$transaction(async (transaction) => {
      const user = await transaction.appUser.create({
        data: {
          fullName,
          email,
          externalIdentities: { create: { issuer, subject, emailSnapshot: email } },
          roles: { create: { roleId: role.id, startDate: today } },
          assignments: { create: { scopeType: 'NACIONAL', startDate: today } },
        },
      });
      await transaction.auditEvent.create({
        data: {
          actorUserId: user.id,
          action: 'SYSTEM_BOOTSTRAP_SUPERADMIN',
          entity: 'USER',
          entityId: user.id,
          dataLevel: 'CONFIGURACION',
          reason: 'Creación controlada del primer usuario institucional.',
          newData: { email, issuer, role: 'SUPERADMIN', scope: 'NACIONAL' },
        },
      });
    });
  } finally {
    await prisma.$disconnect();
  }
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Error desconocido durante bootstrap.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
