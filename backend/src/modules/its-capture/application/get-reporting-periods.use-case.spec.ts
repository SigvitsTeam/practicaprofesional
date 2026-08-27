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
});
