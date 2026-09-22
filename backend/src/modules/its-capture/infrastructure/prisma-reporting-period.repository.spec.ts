import { PrismaReportingPeriodRepository } from './prisma-reporting-period.repository';

describe('PrismaReportingPeriodRepository.listEpidemiologicalWeeks', () => {
  it('returns only active weeks in chronological order with an institutional label', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'week-01',
        year: 2026,
        weekNumber: 1,
        startDate: new Date('2025-12-28T00:00:00.000Z'),
        endDate: new Date('2026-01-03T23:59:59.999Z'),
        active: true,
      },
    ]);
    const repository = new PrismaReportingPeriodRepository({
      client: { epidemiologicalWeek: { findMany } },
    } as never);

    await expect(repository.listEpidemiologicalWeeks(2025, 2026)).resolves.toEqual([
      {
        id: 'week-01',
        year: 2026,
        weekNumber: 1,
        startDate: new Date('2025-12-28T00:00:00.000Z'),
        endDate: new Date('2026-01-03T23:59:59.999Z'),
        active: true,
        label: 'SE 01 · 28/12/2025–03/01/2026',
      },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: { year: { gte: 2025, lte: 2026 }, active: true },
      orderBy: [{ startDate: 'asc' }, { weekNumber: 'asc' }],
      select: {
        id: true,
        year: true,
        weekNumber: true,
        startDate: true,
        endDate: true,
        active: true,
      },
    });
  });
});
