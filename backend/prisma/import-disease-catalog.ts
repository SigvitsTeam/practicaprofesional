import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

interface DiseaseCatalogItem {
  classificationCode: string;
  code?: string;
  name: string;
  appliesToMale: boolean;
  appliesToFemale: boolean;
  requiresAgeAlert?: boolean;
  formatOrder: number;
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`La variable ${name} es obligatoria.`);
  return value;
}

function validateCatalog(value: unknown): DiseaseCatalogItem[] {
  if (!Array.isArray(value) || value.length === 0)
    throw new Error('El catálogo debe contener al menos una enfermedad.');
  const items = value as Partial<DiseaseCatalogItem>[];
  const normalized = items.map((item, index) => {
    if (!item.classificationCode?.trim() || !item.name?.trim())
      throw new Error(`La fila ${index + 1} no tiene clasificación o nombre.`);
    if (typeof item.appliesToMale !== 'boolean' || typeof item.appliesToFemale !== 'boolean')
      throw new Error(`La fila ${index + 1} debe definir aplicación por sexo.`);
    if (!item.appliesToMale && !item.appliesToFemale)
      throw new Error(`La fila ${index + 1} no aplica a ningún sexo.`);
    if (!Number.isInteger(item.formatOrder) || (item.formatOrder ?? 0) < 1)
      throw new Error(`La fila ${index + 1} tiene un orden inválido.`);
    return {
      classificationCode: item.classificationCode.trim().toUpperCase(),
      code: item.code?.trim() || undefined,
      name: item.name.trim(),
      appliesToMale: item.appliesToMale,
      appliesToFemale: item.appliesToFemale,
      requiresAgeAlert: item.requiresAgeAlert ?? false,
      formatOrder: item.formatOrder!,
    };
  });
  const keys = normalized.map(
    (item) => `${item.classificationCode}:${item.name.toLocaleLowerCase('es-HN')}`,
  );
  if (new Set(keys).size !== keys.length)
    throw new Error('El catálogo contiene enfermedades duplicadas dentro de una clasificación.');
  return normalized;
}

async function importCatalog(): Promise<void> {
  const filePath = resolve(
    process.env.ITS_DISEASE_CATALOG_FILE?.trim() || 'prisma/data/its-disease-catalog.json',
  );
  const catalog = validateCatalog(JSON.parse(await readFile(filePath, 'utf8')) as unknown);
  const adapter = new PrismaPg({ connectionString: requiredEnvironment('DIRECT_URL') });
  const prisma = new PrismaClient({ adapter });
  try {
    const classifications = await prisma.itsClassification.findMany({
      where: { program: { code: 'ITS', active: true } },
      select: { id: true, code: true },
    });
    const byCode = new Map(classifications.map((item) => [item.code, item.id]));
    const unknownCodes = [
      ...new Set(
        catalog.map((item) => item.classificationCode).filter((code) => !byCode.has(code)),
      ),
    ];
    if (unknownCodes.length)
      throw new Error(`Clasificaciones desconocidas: ${unknownCodes.join(', ')}.`);

    await prisma.$transaction(
      async (transaction) => {
        for (const item of catalog) {
          const classificationId = byCode.get(item.classificationCode)!;
          await transaction.itsDisease.upsert({
            where: { classificationId_name: { classificationId, name: item.name } },
            update: {
              code: item.code,
              appliesToMale: item.appliesToMale,
              appliesToFemale: item.appliesToFemale,
              requiresAgeAlert: item.requiresAgeAlert,
              formatOrder: item.formatOrder,
              active: true,
            },
            create: {
              classificationId,
              code: item.code,
              name: item.name,
              appliesToMale: item.appliesToMale,
              appliesToFemale: item.appliesToFemale,
              requiresAgeAlert: item.requiresAgeAlert,
              formatOrder: item.formatOrder,
            },
          });
        }
      },
      { timeout: 30_000 },
    );
    process.stdout.write(
      `${JSON.stringify({ file: filePath, importedDiseases: catalog.length })}\n`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

importCatalog().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Error desconocido'}\n`);
  process.exitCode = 1;
});
