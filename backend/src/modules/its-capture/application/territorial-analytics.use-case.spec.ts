import {
  RoleCode,
  type AuthorizationSubject,
} from '../../authorization/domain/authorization.types';
import { TerritorialAnalyticsUseCase } from './territorial-analytics.use-case';
import { TerritorialAnalyticsRepository } from './ports/territorial-analytics.repository';

describe('TerritorialAnalyticsUseCase', () => {
  const list = jest.fn();
  const repository = { list } as unknown as jest.Mocked<TerritorialAnalyticsRepository>;
  const useCase = new TerritorialAnalyticsUseCase(repository);
  const regionalSubject: AuthorizationSubject = {
    userId: 'regional-1',
    roles: [RoleCode.RegionalAdmin],
    permissions: ['analytics:territorial:read'],
    territory: {
      national: false,
      regionIds: ['region-1'],
      municipalityIds: ['municipality-1'],
      facilityIds: ['facility-1'],
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();
    list.mockResolvedValue([]);
  });

  it('aplica el alcance autorizado a la consulta municipal', async () => {
    await useCase.execute({ level: 'MUNICIPIO', year: 2026, month: 8 }, regionalSubject);
    expect(list).toHaveBeenCalledWith({
      level: 'MUNICIPIO',
      year: 2026,
      month: 8,
      scope: regionalSubject.territory,
    });
  });

  it('rechaza el nivel nacional para un usuario regional', async () => {
    await expect(
      useCase.execute({ level: 'REGION', year: 2026, month: 8 }, regionalSubject),
    ).rejects.toThrow('alcance nacional');
    expect(list).not.toHaveBeenCalled();
  });
});
