import {
  buildItsMonthlyReport,
  mergeMunicipalMonthlyReports,
  type ItsMonthlyReport,
  type MonthlyReportSource,
} from './its-monthly-report';

describe('buildItsMonthlyReport', () => {
  it('totaliza diagnóstico, sexo, edad y población según el ITS-2 oficial', () => {
    const source: MonthlyReportSource = {
      facility: {
        id: 'facility-1',
        code: '85481',
        name: 'CIS Linda Coello',
        municipalityName: 'Puerto Cortés',
        regionName: 'Región Sanitaria Departamental de Cortés',
      },
      ageGroups: [
        { code: '10_14', name: '10 a 14 años', formatOrder: 4 },
        { code: '20_24', name: '20 a 24 años', formatOrder: 6 },
      ],
      diseases: [
        {
          id: 'disease-1',
          code: '12',
          name: 'Sífilis',
          classificationCode: 'ETIOLOGICO',
          classificationName: 'Etiológico',
          appliesToMale: true,
          appliesToFemale: true,
          formatOrder: 12,
        },
      ],
      attentions: [
        {
          sex: 'M',
          age: 14,
          ageGroupCode: '10_14',
          populationTypeCode: 'GENERAL',
          isContact: true,
          isPregnant: true,
          diagnoses: [{ diseaseId: 'disease-1', caseType: 'NUEVO' }],
        },
        {
          sex: 'H',
          age: 21,
          ageGroupCode: '20_24',
          populationTypeCode: 'TRABAJADOR_SEXUAL',
          isContact: false,
          isPregnant: false,
          diagnoses: [{ diseaseId: 'disease-1', caseType: 'CONTROL' }],
        },
      ],
    };

    const report = buildItsMonthlyReport(source, 2026, 8);
    const row = report.rows[0];
    if (!row) throw new Error('Expected the report to include the fixture disease.');

    expect(report.totalAttentions).toBe(2);
    expect(report.attentionsUnder15).toBe(1);
    expect(report.attentions15Plus).toBe(1);
    expect(row.diagnosis).toEqual({ newCases: 1, controls: 1 });
    expect(row.sex).toEqual({ male: 1, female: 1 });
    expect(row.ageGroups['10_14']).toEqual({ male: 0, female: 1 });
    expect(row.ageGroups['20_24']).toEqual({ male: 1, female: 0 });
    expect(row.population.generalFemale).toEqual({ newCases: 1, controls: 0 });
    expect(row.population.generalPregnant).toEqual({ newCases: 1, controls: 0 });
    expect(row.population.sexWorkerMale).toEqual({ newCases: 0, controls: 1 });
    expect(row.population.contacts).toEqual({ male: 0, female: 1 });
  });

  it('cuenta una atención con varios diagnósticos en cada fila correspondiente', () => {
    const disease = (id: string, formatOrder: number): MonthlyReportSource['diseases'][number] => ({
      id,
      name: id,
      classificationCode: 'CLINICO',
      classificationName: 'Clínico',
      appliesToMale: true,
      appliesToFemale: true,
      formatOrder,
    });
    const report = buildItsMonthlyReport(
      {
        facility: {
          id: 'facility-1',
          code: '1',
          name: 'Unidad',
          municipalityName: 'Municipio',
          regionName: 'Región',
        },
        ageGroups: [{ code: '30_49', name: '30 a 49 años', formatOrder: 8 }],
        diseases: [disease('a', 1), disease('b', 2)],
        attentions: [
          {
            sex: 'H',
            age: 31,
            ageGroupCode: '30_49',
            populationTypeCode: 'GENERAL',
            isContact: false,
            isPregnant: false,
            diagnoses: [
              { diseaseId: 'a', caseType: 'NUEVO' },
              { diseaseId: 'b', caseType: 'NUEVO' },
            ],
          },
        ],
      },
      2026,
      8,
    );

    expect(report.totalAttentions).toBe(1);
    expect(report.attentionsUnder15).toBe(0);
    expect(report.attentions15Plus).toBe(1);
    expect(report.rows.map((row) => row.diagnosis.newCases)).toEqual([1, 1]);
  });
});

function report(code: string, newCases: number, controls: number): ItsMonthlyReport {
  return {
    facility: {
      id: code,
      code,
      name: `Establecimiento ${code}`,
      municipalityName: 'Puerto Cortés',
      regionName: 'Cortés',
    },
    year: 2026,
    month: 9,
    ageGroups: [{ code: '15_19', name: '15 a 19', formatOrder: 1 }],
    rows: [
      {
        diseaseId: 'disease-1',
        code: 'ITS-01',
        diseaseName: 'Sífilis',
        classificationCode: 'ITS',
        classificationName: 'ITS',
        appliesToMale: true,
        appliesToFemale: true,
        diagnosis: { newCases, controls },
        sex: { male: newCases, female: controls },
        ageGroups: { '15_19': { male: newCases, female: controls } },
        population: {
          generalMale: { newCases, controls: 0 },
          generalFemale: { newCases: 0, controls },
          generalPregnant: { newCases: 0, controls },
          sexWorkerMale: { newCases: 0, controls: 0 },
          sexWorkerFemale: { newCases: 0, controls: 0 },
          sexWorkerPregnant: { newCases: 0, controls: 0 },
          contacts: { male: newCases, female: controls },
        },
      },
    ],
    totalAttentions: newCases + controls,
    attentionsUnder15: 0,
    attentions15Plus: newCases + controls,
  };
}

describe('mergeMunicipalMonthlyReports', () => {
  it('sums every official ITS-2 cell and identifies the document as municipal', () => {
    const consolidated = mergeMunicipalMonthlyReports(
      [report('001', 2, 1), report('002', 3, 4)],
      {
        id: 'municipality-1',
        code: '0506',
        name: 'Puerto Cortés',
        regionName: 'Cortés',
      },
      2026,
      9,
    );

    expect(consolidated.facility).toEqual({
      id: 'municipality-1',
      code: '0506',
      name: 'CONSOLIDADO MUNICIPAL',
      municipalityName: 'Puerto Cortés',
      regionName: 'Cortés',
    });
    expect(consolidated.totalAttentions).toBe(10);
    expect(consolidated.attentions15Plus).toBe(10);
    expect(consolidated.rows[0]?.diagnosis).toEqual({ newCases: 5, controls: 5 });
    expect(consolidated.rows[0]?.ageGroups['15_19']).toEqual({ male: 5, female: 5 });
    expect(consolidated.rows[0]?.population.contacts).toEqual({ male: 5, female: 5 });
  });
});
