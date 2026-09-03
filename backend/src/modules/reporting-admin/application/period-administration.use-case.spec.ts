import {
  RoleCode,
  type AuthorizationSubject,
} from '../../authorization/domain/authorization.types';
import { PeriodAdministrationError, PeriodAccessError } from '../domain/calendar';
import { PeriodAdministrationRepository } from './period-administration.repository';
import { PeriodAdministrationUseCase } from './period-administration.use-case';

const subject = (
  role: RoleCode,
  permission = 'reporting:periods:manage',
  national = true,
): AuthorizationSubject => ({
  userId: '11111111-1111-4111-8111-111111111111',
  roles: [role],
  permissions: [permission],
  territory: { national, regionIds: [], municipalityIds: [], facilityIds: [] },
});
const command = {
  reason: 'Apertura aprobada por vigilancia nacional',
  confirmNationalScope: true,
  requestId: 'qa-request',
};

describe('PeriodAdministrationUseCase', () => {
  const repository = {
    list: jest.fn().mockResolvedValue([]),
    createCalendar: jest.fn().mockResolvedValue({ createdMonths: 12, createdWeeks: 53 }),
    open: jest.fn().mockResolvedValue({}),
    history: jest.fn().mockResolvedValue([]),
    openYear: jest
      .fn()
      .mockResolvedValue({ openedMonths: 12, alreadyOpenMonths: 0, closedMonths: 0 }),
  } satisfies PeriodAdministrationRepository;
  const useCase = new PeriodAdministrationUseCase(repository);
  beforeEach(() => jest.clearAllMocks());

  it.each([RoleCode.SuperAdmin, RoleCode.CentralAdmin])(
    'allows the national %s role with explicit permission',
    async (role) => {
      await useCase.create(2027, command, subject(role));
      expect(repository.createCalendar).toHaveBeenCalledWith(
        2027,
        expect.objectContaining({ actorUserId: expect.any(String), reason: command.reason }),
      );
    },
  );
  it.each([
    subject(RoleCode.RegionalSuperAdmin),
    subject(RoleCode.SuperAdmin, 'reporting:periods:read'),
    subject(RoleCode.SuperAdmin, 'reporting:periods:manage', false),
  ])('rejects a role, permission or scope bypass', (candidate) => {
    expect(() => useCase.list(2027, candidate)).toThrow(PeriodAccessError);
    expect(repository.list).not.toHaveBeenCalled();
  });
  it('validates confirmation and reason before invoking the repository', () => {
    expect(() =>
      useCase.create(
        2027,
        { ...command, confirmNationalScope: false },
        subject(RoleCode.SuperAdmin),
      ),
    ).toThrow(PeriodAdministrationError);
    expect(() =>
      useCase.create(2027, { ...command, reason: 'breve' }, subject(RoleCode.SuperAdmin)),
    ).toThrow(PeriodAdministrationError);
    expect(repository.createCalendar).not.toHaveBeenCalled();
  });
  it('validates the optimistic version before opening', () => {
    expect(() =>
      useCase.open('period', 'not-a-date', command, subject(RoleCode.CentralAdmin)),
    ).toThrow(PeriodAdministrationError);
    expect(repository.open).not.toHaveBeenCalled();
  });
  it('requires twelve distinct versions and authorization for annual opening', async () => {
    const versions = Array.from({ length: 12 }, (_, index) => ({
      id: `month-${index}`,
      updatedAt: '2026-09-03T12:00:00.000Z',
    }));
    expect(() =>
      useCase.openYear(2026, versions, command, subject(RoleCode.RegionalSuperAdmin)),
    ).toThrow(PeriodAccessError);
    expect(() =>
      useCase.openYear(2026, versions.slice(1), command, subject(RoleCode.CentralAdmin)),
    ).toThrow(PeriodAdministrationError);
    expect(() =>
      useCase.openYear(
        2026,
        Array.from({ length: 12 }, () => versions[0]!),
        command,
        subject(RoleCode.CentralAdmin),
      ),
    ).toThrow(PeriodAdministrationError);
    expect(repository.openYear).not.toHaveBeenCalled();
    await useCase.openYear(2026, versions, command, subject(RoleCode.CentralAdmin));
    expect(repository.openYear).toHaveBeenCalledWith(
      2026,
      expect.arrayContaining([{ id: 'month-0', updatedAt: new Date('2026-09-03T12:00:00.000Z') }]),
      expect.objectContaining({ actorUserId: expect.any(String) }),
    );
  });
});
