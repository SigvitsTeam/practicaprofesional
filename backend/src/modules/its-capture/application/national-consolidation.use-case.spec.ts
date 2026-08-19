import type { AuthorizationSubject } from '../../authorization/domain/authorization.types';
import { NationalConsolidationAccessError } from '../domain/national-consolidation';
import { NationalConsolidationUseCase } from './national-consolidation.use-case';
import { NationalConsolidationRepository } from './ports/national-consolidation.repository';

const regional: AuthorizationSubject = {
  userId: 'regional',
  roles: [],
  permissions: [],
  territory: { national: false, regionIds: ['r1'], municipalityIds: [], facilityIds: [] },
};
const national: AuthorizationSubject = {
  userId: 'central',
  roles: [],
  permissions: [],
  territory: { national: true, regionIds: [], municipalityIds: [], facilityIds: [] },
};

describe('NationalConsolidationUseCase', () => {
  const prepare = jest.fn();
  const close = jest.fn();
  const repository = {
    getContext: jest.fn(),
    prepare,
    getCurrent: jest.fn(),
    finalize: jest.fn(),
    close,
    reopen: jest.fn(),
  } as unknown as jest.Mocked<NationalConsolidationRepository>;
  const useCase = new NationalConsolidationUseCase(repository);

  beforeEach(() => jest.clearAllMocks());

  it('rejects national preparation from regional scope', () => {
    expect(() => useCase.prepare({ year: 2026, month: 8 }, regional)).toThrow(
      NationalConsolidationAccessError,
    );
    expect(prepare).not.toHaveBeenCalled();
  });

  it('passes a mandatory close reason with the authenticated actor', async () => {
    close.mockResolvedValue({ id: 'report-1' });
    await useCase.close('report-1', 'Cierre institucional aprobado', national);
    expect(close).toHaveBeenCalledWith('report-1', 'central', 'Cierre institucional aprobado');
  });
});
