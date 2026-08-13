import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { RenderIts1PdfUseCase } from '../src/modules/its-capture/application/render-its1-pdf.use-case';
import type { Its1PrintRegister } from '../src/modules/its-capture/domain/its1-print-register';

const diseases = Array.from({ length: 18 }, (_, index) => ({
  id: `disease-${index + 1}`,
  formatOrder: index + 1,
}));

const register: Its1PrintRegister = {
  facility: {
    id: 'preview',
    code: '85481',
    name: 'CIS Linda Coello',
    municipalityName: 'Puerto Cortés',
    regionName: 'Cortés',
  },
  year: 2026,
  month: 8,
  responsibleName: 'Responsable de prueba',
  diseases,
  attentions: Array.from({ length: 28 }, (_, index) => ({
    originText: `Barrio ${index + 1}`,
    patientRecordNumber: `EXP-${String(index + 1).padStart(4, '0')}`,
    sex: index % 2 === 0 ? 'H' : 'M',
    age: 18 + index,
    populationTypeCode: index % 3 === 0 ? 'TRABAJADOR_SEXUAL' : 'GENERAL',
    isContact: index % 4 === 0,
    isPregnant: index % 6 === 1,
    diagnoses: [
      {
        diseaseId: `disease-${(index % 18) + 1}`,
        caseType: index % 2 === 0 ? 'NUEVO' : 'CONTROL',
      },
    ],
  })),
};

async function main(): Promise<void> {
  const output = resolve('..', 'tmp', 'pdfs', 'qa-filled-its1.pdf');
  await mkdir(resolve('..', 'tmp', 'pdfs'), { recursive: true });
  await writeFile(output, await new RenderIts1PdfUseCase().execute(register));
  process.stdout.write(`${output}\n`);
}

void main();
