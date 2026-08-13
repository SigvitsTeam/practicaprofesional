import type { BiologicalSex, DiagnosisCaseType } from './its-attention';

export interface Its1PrintRegister {
  facility: {
    id: string;
    code: string;
    name: string;
    municipalityName: string;
    regionName: string;
  };
  year: number;
  month: number;
  responsibleName: string;
  diseases: { id: string; formatOrder: number }[];
  attentions: {
    originText: string;
    patientRecordNumber: string;
    sex: BiologicalSex;
    age: number;
    populationTypeCode: string;
    isContact: boolean;
    isPregnant: boolean;
    diagnoses: { diseaseId: string; caseType: DiagnosisCaseType }[];
  }[];
}
