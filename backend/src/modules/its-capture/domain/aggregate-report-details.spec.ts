import { aggregateReportDetails, type AggregatableReportDetail } from './aggregate-report-details';

describe('aggregateReportDetails', () => {
  const detail: AggregatableReportDetail = {
    diseaseId: 'disease-1',
    ageGroupId: 'age-1',
    sex: 'M',
    populationTypeId: 'population-1',
    caseType: 'NUEVO',
    isContact: false,
    isPregnant: false,
    total: 3,
  };

  it('sums identical dimensions across source reports', () => {
    expect(aggregateReportDetails([[detail], [{ ...detail, total: 4 }]])).toEqual([
      { ...detail, total: 7 },
    ]);
  });

  it('keeps distinct epidemiological dimensions separated', () => {
    const result = aggregateReportDetails([
      [detail],
      [{ ...detail, sex: 'H', total: 2 }],
      [{ ...detail, caseType: 'CONTROL', total: 1 }],
    ]);
    expect(result).toHaveLength(3);
    expect(result.reduce((total, item) => total + item.total, 0)).toBe(6);
  });
});
