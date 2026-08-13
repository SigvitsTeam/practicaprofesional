import type { BiologicalSex, DiagnosisCaseType } from './its-attention';

export interface MonthlyReportAttention {
  sex: BiologicalSex;
  ageGroupCode: string;
  populationTypeCode: string;
  isContact: boolean;
  isPregnant: boolean;
  diagnoses: { diseaseId: string; caseType: DiagnosisCaseType }[];
}

export interface MonthlyReportDisease {
  id: string;
  code?: string;
  name: string;
  classificationCode: string;
  classificationName: string;
  appliesToMale: boolean;
  appliesToFemale: boolean;
  formatOrder: number;
}

export interface MonthlyReportCell {
  male: number;
  female: number;
}

export interface MonthlyReportCaseCell {
  newCases: number;
  controls: number;
}

export interface MonthlyReportRow {
  diseaseId: string;
  code?: string;
  diseaseName: string;
  classificationCode: string;
  classificationName: string;
  appliesToMale: boolean;
  appliesToFemale: boolean;
  diagnosis: MonthlyReportCaseCell;
  sex: MonthlyReportCell;
  ageGroups: Record<string, MonthlyReportCell>;
  population: {
    generalMale: MonthlyReportCaseCell;
    generalFemale: MonthlyReportCaseCell;
    generalPregnant: MonthlyReportCaseCell;
    sexWorkerMale: MonthlyReportCaseCell;
    sexWorkerFemale: MonthlyReportCaseCell;
    sexWorkerPregnant: MonthlyReportCaseCell;
    contacts: MonthlyReportCell;
  };
}

export interface ItsMonthlyReport {
  facility: {
    id: string;
    code: string;
    name: string;
    municipalityName: string;
    regionName: string;
  };
  year: number;
  month: number;
  ageGroups: { code: string; name: string; formatOrder: number }[];
  rows: MonthlyReportRow[];
  totalAttentions: number;
}

export interface MonthlyReportSource {
  facility: ItsMonthlyReport['facility'];
  ageGroups: ItsMonthlyReport['ageGroups'];
  diseases: MonthlyReportDisease[];
  attentions: MonthlyReportAttention[];
}

const emptyCaseCell = (): MonthlyReportCaseCell => ({ newCases: 0, controls: 0 });
const emptySexCell = (): MonthlyReportCell => ({ male: 0, female: 0 });

function incrementCase(cell: MonthlyReportCaseCell, caseType: DiagnosisCaseType): void {
  if (caseType === 'NUEVO') cell.newCases += 1;
  else cell.controls += 1;
}

export function buildItsMonthlyReport(
  source: MonthlyReportSource,
  year: number,
  month: number,
): ItsMonthlyReport {
  const rows = source.diseases.map<MonthlyReportRow>((disease) => ({
    diseaseId: disease.id,
    code: disease.code,
    diseaseName: disease.name,
    classificationCode: disease.classificationCode,
    classificationName: disease.classificationName,
    appliesToMale: disease.appliesToMale,
    appliesToFemale: disease.appliesToFemale,
    diagnosis: emptyCaseCell(),
    sex: emptySexCell(),
    ageGroups: Object.fromEntries(source.ageGroups.map((group) => [group.code, emptySexCell()])),
    population: {
      generalMale: emptyCaseCell(),
      generalFemale: emptyCaseCell(),
      generalPregnant: emptyCaseCell(),
      sexWorkerMale: emptyCaseCell(),
      sexWorkerFemale: emptyCaseCell(),
      sexWorkerPregnant: emptyCaseCell(),
      contacts: emptySexCell(),
    },
  }));
  const byDiseaseId = new Map(rows.map((row) => [row.diseaseId, row]));

  for (const attention of source.attentions) {
    for (const diagnosis of attention.diagnoses) {
      const row = byDiseaseId.get(diagnosis.diseaseId);
      if (!row) continue;
      incrementCase(row.diagnosis, diagnosis.caseType);
      row.sex[attention.sex === 'H' ? 'male' : 'female'] += 1;
      const ageCell = row.ageGroups[attention.ageGroupCode];
      if (ageCell) ageCell[attention.sex === 'H' ? 'male' : 'female'] += 1;

      const isSexWorker = attention.populationTypeCode === 'TRABAJADOR_SEXUAL';
      const sexKey = attention.sex === 'H' ? 'Male' : 'Female';
      incrementCase(
        row.population[`${isSexWorker ? 'sexWorker' : 'general'}${sexKey}`],
        diagnosis.caseType,
      );
      if (attention.sex === 'M' && attention.isPregnant) {
        incrementCase(
          row.population[isSexWorker ? 'sexWorkerPregnant' : 'generalPregnant'],
          diagnosis.caseType,
        );
      }
      if (attention.isContact)
        row.population.contacts[attention.sex === 'H' ? 'male' : 'female'] += 1;
    }
  }

  return { ...source, year, month, rows, totalAttentions: source.attentions.length };
}
