import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { RenderIts2PdfUseCase } from '../src/modules/its-capture/application/render-its2-pdf.use-case';
import type { ItsMonthlyReport } from '../src/modules/its-capture/domain/its-monthly-report';

const ageGroupDefinitions = [
  ['MENOR_1', 'Menor de 1 año'],
  ['1_4', '1 a 4 años'],
  ['5_9', '5 a 9 años'],
  ['10_14', '10 a 14 años'],
  ['15_19', '15 a 19 años'],
  ['20_24', '20 a 24 años'],
  ['25_29', '25 a 29 años'],
  ['30_49', '30 a 49 años'],
  ['50_MAS', '50 años y más'],
] as const;
const ageGroups: ItsMonthlyReport['ageGroups'] = ageGroupDefinitions.map(([code, name], index) => ({
  code,
  name,
  formatOrder: index + 1,
}));

const diseases = [
  ['SINDROMICO', 'Sindrómico', 'Flujo uretral'],
  ['SINDROMICO', 'Sindrómico', 'Cervicitis'],
  ['SINDROMICO', 'Sindrómico', 'Vaginitis'],
  ['SINDROMICO', 'Sindrómico', 'Úlcera genital'],
  ['SINDROMICO', 'Sindrómico', 'EPI'],
  ['SINDROMICO', 'Sindrómico', 'Bubón inguinal'],
  ['CLINICO', 'Clínico', 'Molusco contagioso'],
  ['CLINICO', 'Clínico', 'Granuloma inguinal'],
  ['CLINICO', 'Clínico', 'Condiloma acuminado'],
  ['CE', 'C/E', 'Vaginosis bacteriana'],
  ['CE', 'C/E', 'Sífilis congénita'],
  ['ETIOLOGICO', 'Etiológico', 'Sífilis'],
  ['ETIOLOGICO', 'Etiológico', 'Chlamydia trachomatis'],
  ['ETIOLOGICO', 'Etiológico', 'Trichomonas'],
  ['ETIOLOGICO', 'Etiológico', 'Cándida albicans'],
  ['ETIOLOGICO', 'Etiológico', 'Neisseria gonorrhoeae'],
  ['ETIOLOGICO', 'Etiológico', 'Herpes genital'],
  ['ETIOLOGICO', 'Etiológico', 'Hepatitis B'],
] as const;

const report: ItsMonthlyReport = {
  facility: {
    id: 'preview',
    code: '85481',
    name: 'CIS Linda Coello',
    municipalityName: 'Puerto Cortés',
    regionName: 'Cortés',
  },
  year: 2026,
  month: 8,
  ageGroups,
  totalAttentions: 18,
  rows: diseases.map(([classificationCode, classificationName, diseaseName], index) => ({
    diseaseId: String(index + 1),
    code: String(index + 1).padStart(2, '0'),
    diseaseName,
    classificationCode,
    classificationName,
    appliesToMale: true,
    appliesToFemale: true,
    diagnosis: { newCases: index + 1, controls: index % 3 },
    sex: { male: index % 4, female: index % 5 },
    ageGroups: Object.fromEntries(
      ageGroups.map((group, ageIndex) => [
        group.code,
        {
          male: ageIndex === index % 9 ? 1 : 0,
          female: ageIndex === (index + 1) % 9 ? 1 : 0,
        },
      ]),
    ),
    population: {
      generalMale: { newCases: index % 2, controls: 0 },
      generalFemale: { newCases: (index + 1) % 2, controls: index % 3 === 0 ? 1 : 0 },
      generalPregnant: { newCases: index % 5 === 0 ? 1 : 0, controls: 0 },
      sexWorkerMale: { newCases: 0, controls: index % 7 === 0 ? 1 : 0 },
      sexWorkerFemale: { newCases: index % 6 === 0 ? 1 : 0, controls: 0 },
      sexWorkerPregnant: { newCases: 0, controls: 0 },
      contacts: { male: index % 8 === 0 ? 1 : 0, female: index % 4 === 0 ? 1 : 0 },
    },
  })),
};

async function main(): Promise<void> {
  const output = resolve('..', 'tmp', 'pdfs', 'qa-filled-its2.pdf');
  await mkdir(resolve('..', 'tmp', 'pdfs'), { recursive: true });
  await writeFile(output, await new RenderIts2PdfUseCase().execute(report));
  process.stdout.write(`${output}\n`);
}

void main();
