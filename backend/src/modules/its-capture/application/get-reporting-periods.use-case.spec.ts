import { GetReportingPeriodsUseCase } from './get-reporting-periods.use-case';
import { ReportingPeriodRepository } from './ports/reporting-period.repository';

describe('GetReportingPeriodsUseCase', () => {
  it('bounds the catalog size before querying the repository', async () => {
    const listMonthly = jest.fn().mockResolvedValue([]);
    const repository = { listMonthly } as unknown as ReportingPeriodRepository;
    const useCase = new GetReportingPeriodsUseCase(repository);

    await useCase.execute(500);

    expect(listMonthly).toHaveBeenCalledWith(60);
  });

  it('returns active institutional weeks for a bounded year range', async () => {
    const listEpidemiologicalWeeks = jest.fn().mockResolvedValue([]);
    const repository = { listEpidemiologicalWeeks } as unknown as ReportingPeriodRepository;
    const useCase = new GetReportingPeriodsUseCase(repository);

    await useCase.epidemiologicalWeeks(2025, 2026);

    expect(listEpidemiologicalWeeks).toHaveBeenCalledWith(2025, 2026);
  });

  it('rejects inverted or unbounded epidemiological year ranges', () => {
    const useCase = new GetReportingPeriodsUseCase({} as ReportingPeriodRepository);

    expect(() => useCase.epidemiologicalWeeks(2026, 2025)).toThrow(
      'El rango de años debe estar ordenado',
    );
    expect(() => useCase.epidemiologicalWeeks(2020, 2025)).toThrow(
      'El rango de años debe estar ordenado',
    );
  });
});
