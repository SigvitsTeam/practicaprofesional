import { CancelAttentionUseCase } from './cancel-attention.use-case';
import { ItsAttentionRepository } from './ports/its-attention.repository';

describe('CancelAttentionUseCase', () => {
  const cancel = jest.fn();
  const repository = { cancel } as unknown as jest.Mocked<ItsAttentionRepository>;
  const useCase = new CancelAttentionUseCase(repository);
  const input = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    facilityId: '11111111-1111-4111-8111-111111111111',
    expectedUpdatedAt: new Date('2026-08-19T12:00:00.000Z'),
    userId: 'user-1',
    requestId: 'request-1',
    reason: '  Registro duplicado confirmado por coordinación.  ',
  };

  beforeEach(() => {
    jest.resetAllMocks();
    cancel.mockResolvedValue({
      id: input.id,
      status: 'ANULADO',
      updatedAt: new Date('2026-08-19T13:00:00.000Z'),
    });
  });

  it('normaliza el motivo y delega la anulación versionada', async () => {
    await useCase.execute(input);
    expect(cancel).toHaveBeenCalledWith({
      ...input,
      reason: 'Registro duplicado confirmado por coordinación.',
    });
  });

  it('rechaza motivos insuficientes', () => {
    expect(() => useCase.execute({ ...input, reason: 'duplicado' })).toThrow('entre 10 y 500');
    expect(cancel).not.toHaveBeenCalled();
  });
});
