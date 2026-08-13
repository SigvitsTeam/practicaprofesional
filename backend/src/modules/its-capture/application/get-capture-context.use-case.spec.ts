import { GetCaptureContextUseCase } from './get-capture-context.use-case';
import { ItsAttentionRepository } from './ports/its-attention.repository';

describe('GetCaptureContextUseCase', () => {
  it('deduplicates the facilities assigned to the authenticated user', async () => {
    const getCaptureContext = jest.fn().mockResolvedValue({
      facilities: [],
      populationTypes: [],
      classifications: [],
    });
    const repository = { getCaptureContext } as unknown as ItsAttentionRepository;
    const useCase = new GetCaptureContextUseCase(repository);

    await useCase.execute(['facility-1', 'facility-1', 'facility-2']);

    expect(getCaptureContext).toHaveBeenCalledWith(['facility-1', 'facility-2']);
  });
});
