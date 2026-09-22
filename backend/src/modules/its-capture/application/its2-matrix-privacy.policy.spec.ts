import { ConfigService } from '@nestjs/config';
import type { ItsMonthlyReport, MonthlyReportRow } from '../domain/its-monthly-report';
import { Its2MatrixPrivacyPolicy } from './its2-matrix-privacy.policy';

function row(newCases: number): MonthlyReportRow {
  return {
    diseaseId: `disease-${newCases}`,
    diseaseName: `Disease ${newCases}`,
    classificationCode: 'ITS',
    classificationName: 'ITS',
    appliesToMale: true,
    appliesToFemale: true,
    diagnosis: { newCases, controls: 0 },
    sex: { male: newCases, female: 0 },
    ageGroups: { '15_19': { male: newCases, female: 0 } },
    population: {
      generalMale: { newCases, controls: 0 },
      generalFemale: { newCases: 0, controls: 0 },
      generalPregnant: { newCases: 0, controls: 0 },
      sexWorkerMale: { newCases: 0, controls: 0 },
      sexWorkerFemale: { newCases: 0, controls: 0 },
      sexWorkerPregnant: { newCases: 0, controls: 0 },
      contacts: { male: 0, female: 0 },
    },
  };
}

function report(rows: MonthlyReportRow[]): ItsMonthlyReport {
  return {
    facility: {
      id: 'municipality-1',
      code: '0506',
      name: 'CONSOLIDADO MUNICIPAL',
      municipalityName: 'Puerto Cortés',
      regionName: 'Cortés',
    },
    year: 2026,
    month: 9,
    ageGroups: [{ code: '15_19', name: '15 a 19', formatOrder: 1 }],
    rows,
    totalAttentions: 0,
    attentionsUnder15: 0,
    attentions15Plus: 0,
  };
}

describe('Its2MatrixPrivacyPolicy', () => {
  it('protects the complete disease row and every total when one cell is small', () => {
    const policy = new Its2MatrixPrivacyPolicy(
      new ConfigService({ app: { territorialAnalyticsSmallCountThreshold: 5 } }),
    );

    expect(policy.protect(report([row(3), row(8)]))).toEqual({
      smallCountThreshold: 5,
      protectedRowIndexes: [0],
      protectTotals: true,
    });
  });

  it('does not protect rows when suppression is disabled', () => {
    const policy = new Its2MatrixPrivacyPolicy(
      new ConfigService({ app: { territorialAnalyticsSmallCountThreshold: 0 } }),
    );

    expect(policy.protect(report([row(1)]))).toEqual({
      smallCountThreshold: 0,
      protectedRowIndexes: [],
      protectTotals: false,
    });
  });
});
