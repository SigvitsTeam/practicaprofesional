import type { BiologicalSex, DiagnosisCaseType } from './its-attention';

export interface AggregatableReportDetail {
  diseaseId: string;
  ageGroupId: string | null;
  sex: BiologicalSex | null;
  populationTypeId: string | null;
  caseType: DiagnosisCaseType | null;
  isContact: boolean | null;
  isPregnant: boolean | null;
  total: number;
}

export function aggregateReportDetails(
  sources: readonly (readonly AggregatableReportDetail[])[],
): AggregatableReportDetail[] {
  const grouped = new Map<string, AggregatableReportDetail>();
  for (const details of sources) {
    for (const detail of details) {
      const key = [
        detail.diseaseId,
        detail.ageGroupId,
        detail.sex,
        detail.populationTypeId,
        detail.caseType,
        detail.isContact,
        detail.isPregnant,
      ].join('|');
      const existing = grouped.get(key);
      grouped.set(key, { ...detail, total: (existing?.total ?? 0) + detail.total });
    }
  }
  return [...grouped.values()];
}
