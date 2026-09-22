import { InvalidExportJobError } from '../domain/export-job';
import { PrismaMunicipalIts2ExportRepository } from './prisma-municipal-its2-export.repository';

describe('PrismaMunicipalIts2ExportRepository', () => {
  const reportingPeriodFindMany = jest.fn();
  const epidemiologicalWeekFindFirst = jest.fn();
  const epidemiologicalWeekFindMany = jest.fn();
  const municipalityFindFirst = jest.fn();
  const ageGroupFindMany = jest.fn();
  const diseaseFindMany = jest.fn();
  const attentionFindMany = jest.fn();
  const repository = new PrismaMunicipalIts2ExportRepository({
    client: {
      reportingPeriod: { findMany: reportingPeriodFindMany },
      epidemiologicalWeek: {
        findFirst: epidemiologicalWeekFindFirst,
        findMany: epidemiologicalWeekFindMany,
      },
      municipality: { findFirst: municipalityFindFirst },
      ageGroup: { findMany: ageGroupFindMany },
      itsDisease: { findMany: diseaseFindMany },
      itsAttention: { findMany: attentionFindMany },
    },
  } as never);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('resolveRange', () => {
    it('resolves an inclusive monthly range using the institutional calendar', async () => {
      reportingPeriodFindMany.mockResolvedValue([
        {
          year: 2026,
          month: 3,
          startDate: new Date('2026-03-01T00:00:00.000Z'),
          endDate: new Date('2026-03-31T23:59:59.999Z'),
        },
        {
          year: 2026,
          month: 1,
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-01-31T23:59:59.999Z'),
        },
        {
          year: 2026,
          month: 2,
          startDate: new Date('2026-02-01T00:00:00.000Z'),
          endDate: new Date('2026-02-28T23:59:59.999Z'),
        },
      ]);

      await expect(
        repository.resolveRange({
          timeUnit: 'MONTH',
          startPeriod: '2026-01',
          endPeriod: '2026-03',
        }),
      ).resolves.toEqual({
        parameters: {
          timeUnit: 'MONTH',
          startPeriod: '2026-01',
          endPeriod: '2026-03',
        },
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-03-31T23:59:59.999Z'),
        anchorYear: 2026,
        anchorMonth: 3,
        periodLabel: '01–03',
        yearLabel: '2026',
        filenameLabel: 'MES-2026-01_a_2026-03',
      });

      expect(reportingPeriodFindMany).toHaveBeenCalledWith({
        where: {
          type: 'MENSUAL',
          OR: [
            { year: 2026, month: 1 },
            { year: 2026, month: 2 },
            { year: 2026, month: 3 },
          ],
        },
        select: { year: true, month: true, startDate: true, endDate: true },
      });
    });

    it('rejects malformed, inverted, oversized, or incomplete monthly ranges', async () => {
      await expect(
        repository.resolveRange({
          timeUnit: 'MONTH',
          startPeriod: '2026-1',
          endPeriod: '2026-02',
        }),
      ).rejects.toThrow('Los meses deben usar el formato institucional YYYY-MM.');
      await expect(
        repository.resolveRange({
          timeUnit: 'MONTH',
          startPeriod: '2026-03',
          endPeriod: '2026-02',
        }),
      ).rejects.toThrow('El rango mensual no puede estar invertido.');
      await expect(
        repository.resolveRange({
          timeUnit: 'MONTH',
          startPeriod: '2024-01',
          endPeriod: '2026-01',
        }),
      ).rejects.toThrow('como máximo 24 meses');

      reportingPeriodFindMany.mockResolvedValue([
        {
          year: 2026,
          month: 1,
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-01-31T23:59:59.999Z'),
        },
      ]);
      await expect(
        repository.resolveRange({
          timeUnit: 'MONTH',
          startPeriod: '2026-01',
          endPeriod: '2026-02',
        }),
      ).rejects.toThrow('no está completo en el calendario institucional');

      reportingPeriodFindMany.mockResolvedValue([
        {
          year: 2026,
          month: 1,
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-01-31T23:59:59.999Z'),
        },
        {
          year: 2026,
          month: 2,
          startDate: new Date('2026-02-02T00:00:00.000Z'),
          endDate: new Date('2026-02-28T23:59:59.999Z'),
        },
      ]);
      await expect(
        repository.resolveRange({
          timeUnit: 'MONTH',
          startPeriod: '2026-01',
          endPeriod: '2026-02',
        }),
      ).rejects.toThrow('no es continuo en el calendario institucional');
    });

    it('resolves active epidemiological weeks inclusively and preserves their ids', async () => {
      const weeks = [
        week('week-01', 2026, 1, '2025-12-28', '2026-01-03'),
        week('week-02', 2026, 2, '2026-01-04', '2026-01-10'),
        week('week-03', 2026, 3, '2026-01-11', '2026-01-17'),
      ];
      epidemiologicalWeekFindFirst.mockResolvedValueOnce(weeks[0]).mockResolvedValueOnce(weeks[2]);
      epidemiologicalWeekFindMany.mockResolvedValue(weeks);

      await expect(
        repository.resolveRange({
          timeUnit: 'EPIDEMIOLOGICAL_WEEK',
          startPeriod: '2026-W01',
          endPeriod: '2026-W03',
        }),
      ).resolves.toEqual({
        parameters: {
          timeUnit: 'EPIDEMIOLOGICAL_WEEK',
          startPeriod: '2026-W01',
          endPeriod: '2026-W03',
        },
        startDate: new Date('2025-12-28T00:00:00.000Z'),
        endDate: new Date('2026-01-17T00:00:00.000Z'),
        anchorYear: 2026,
        anchorMonth: 1,
        periodLabel: 'SE01–SE03',
        yearLabel: '2026',
        filenameLabel: 'SE-2026-W01_a_2026-W03',
        epidemiologicalWeekIds: ['week-01', 'week-02', 'week-03'],
      });

      expect(epidemiologicalWeekFindFirst).toHaveBeenNthCalledWith(1, {
        where: { year: 2026, weekNumber: 1, active: true },
        select: {
          id: true,
          year: true,
          weekNumber: true,
          startDate: true,
          endDate: true,
        },
      });
      expect(epidemiologicalWeekFindMany).toHaveBeenCalledWith({
        where: {
          active: true,
          startDate: { gte: weeks[0]!.startDate },
          endDate: { lte: weeks[2]!.endDate },
        },
        orderBy: { startDate: 'asc' },
        select: {
          id: true,
          year: true,
          weekNumber: true,
          startDate: true,
          endDate: true,
        },
      });
    });

    it('rejects missing endpoints and gaps in the epidemiological calendar', async () => {
      epidemiologicalWeekFindFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(week('week-02', 2026, 2, '2026-01-04', '2026-01-10'));
      await expect(
        repository.resolveRange({
          timeUnit: 'EPIDEMIOLOGICAL_WEEK',
          startPeriod: '2026-W01',
          endPeriod: '2026-W02',
        }),
      ).rejects.toThrow('no existe o está invertido');
      expect(epidemiologicalWeekFindMany).not.toHaveBeenCalled();

      jest.resetAllMocks();
      const first = week('week-01', 2026, 1, '2025-12-28', '2026-01-03');
      const last = week('week-03', 2026, 3, '2026-01-12', '2026-01-18');
      epidemiologicalWeekFindFirst.mockResolvedValueOnce(first).mockResolvedValueOnce(last);
      epidemiologicalWeekFindMany.mockResolvedValue([first, last]);
      await expect(
        repository.resolveRange({
          timeUnit: 'EPIDEMIOLOGICAL_WEEK',
          startPeriod: '2026-W01',
          endPeriod: '2026-W03',
        }),
      ).rejects.toThrow('no es continuo en el calendario institucional');
    });
  });

  describe('getReportSource', () => {
    beforeEach(() => {
      municipalityFindFirst.mockResolvedValue({
        id: 'municipality-0501',
        officialCode: '0501',
        name: 'San Pedro Sula',
        region: { name: 'Cortés' },
      });
      ageGroupFindMany.mockResolvedValue([{ code: '15-19', name: '15 a 19', formatOrder: 1 }]);
      diseaseFindMany.mockResolvedValue([
        {
          id: 'disease-1',
          code: null,
          name: 'Sífilis',
          appliesToMale: true,
          appliesToFemale: true,
          formatOrder: 1,
          classification: { code: 'ITS', name: 'Infecciones de transmisión sexual' },
        },
      ]);
      attentionFindMany.mockResolvedValue([
        {
          sex: 'H',
          age: 18,
          isContact: false,
          isPregnant: false,
          ageGroup: { code: '15-19' },
          populationType: { code: 'POBLACION_GENERAL' },
          diagnoses: [{ diseaseId: 'disease-1', caseType: 'NUEVO' }],
        },
      ]);
    });

    it('loads every establishment contribution through the denormalized municipality and date range', async () => {
      const range = {
        parameters: {
          timeUnit: 'MONTH' as const,
          startPeriod: '2026-01',
          endPeriod: '2026-03',
        },
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-03-31T23:59:59.999Z'),
        anchorYear: 2026,
        anchorMonth: 3,
        periodLabel: '01–03',
        yearLabel: '2026',
        filenameLabel: 'MES-2026-01_a_2026-03',
      };

      await expect(
        repository.getReportSource({ municipalityId: 'municipality-0501', range }),
      ).resolves.toEqual({
        facility: {
          id: 'municipality-0501',
          code: '0501',
          name: 'CONSOLIDADO MUNICIPAL',
          municipalityName: 'San Pedro Sula',
          regionName: 'Cortés',
        },
        ageGroups: [{ code: '15-19', name: '15 a 19', formatOrder: 1 }],
        diseases: [
          {
            id: 'disease-1',
            code: undefined,
            name: 'Sífilis',
            classificationCode: 'ITS',
            classificationName: 'Infecciones de transmisión sexual',
            appliesToMale: true,
            appliesToFemale: true,
            formatOrder: 1,
          },
        ],
        attentions: [
          {
            sex: 'H',
            age: 18,
            ageGroupCode: '15-19',
            populationTypeCode: 'POBLACION_GENERAL',
            isContact: false,
            isPregnant: false,
            diagnoses: [{ diseaseId: 'disease-1', caseType: 'NUEVO' }],
          },
        ],
      });

      const query = attentionFindMany.mock.calls[0][0];
      expect(query.where).toEqual({
        municipalityId: 'municipality-0501',
        status: 'ACTIVO',
        attentionDate: { gte: range.startDate, lte: range.endDate },
      });
      expect(query.where).not.toHaveProperty('facilityId');
    });

    it('uses the resolved week ids instead of dates for epidemiological ranges', async () => {
      const range = {
        parameters: {
          timeUnit: 'EPIDEMIOLOGICAL_WEEK' as const,
          startPeriod: '2026-W01',
          endPeriod: '2026-W02',
        },
        startDate: new Date('2025-12-28T00:00:00.000Z'),
        endDate: new Date('2026-01-10T23:59:59.999Z'),
        anchorYear: 2026,
        anchorMonth: 1,
        periodLabel: 'SE01–SE02',
        yearLabel: '2026',
        filenameLabel: 'SE-2026-W01_a_2026-W02',
        epidemiologicalWeekIds: ['week-01', 'week-02'],
      };

      await repository.getReportSource({ municipalityId: 'municipality-0501', range });

      expect(attentionFindMany.mock.calls[0][0].where).toEqual({
        municipalityId: 'municipality-0501',
        status: 'ACTIVO',
        epidemiologicalWeekId: { in: ['week-01', 'week-02'] },
      });
    });

    it('rejects an inactive or unknown municipality', async () => {
      municipalityFindFirst.mockResolvedValue(null);

      await expect(
        repository.getReportSource({
          municipalityId: 'municipality-missing',
          range: {
            parameters: {
              timeUnit: 'MONTH',
              startPeriod: '2026-01',
              endPeriod: '2026-01',
            },
            startDate: new Date('2026-01-01T00:00:00.000Z'),
            endDate: new Date('2026-01-31T23:59:59.999Z'),
            anchorYear: 2026,
            anchorMonth: 1,
            periodLabel: '01–01',
            yearLabel: '2026',
            filenameLabel: 'MES-2026-01_a_2026-01',
          },
        }),
      ).rejects.toBeInstanceOf(InvalidExportJobError);
    });
  });
});

function week(
  id: string,
  year: number,
  weekNumber: number,
  startDate: string,
  endDate: string,
): {
  id: string;
  year: number;
  weekNumber: number;
  startDate: Date;
  endDate: Date;
} {
  return {
    id,
    year,
    weekNumber,
    startDate: new Date(`${startDate}T00:00:00.000Z`),
    endDate: new Date(`${endDate}T00:00:00.000Z`),
  };
}
