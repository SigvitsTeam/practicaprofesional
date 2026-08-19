import { InvalidAttentionError, type AttentionRecord } from '../domain/its-attention';
import { ListAttentionsUseCase } from './list-attentions.use-case';
import { ItsAttentionRepository } from './ports/its-attention.repository';

describe('ListAttentionsUseCase', () => {
  const list = jest.fn();
  const repository = { list } as unknown as jest.Mocked<ItsAttentionRepository>;
  const useCase = new ListAttentionsUseCase(repository);
  const base = {
    facilityId: '11111111-1111-4111-8111-111111111111',
    year: 2026,
    month: 8,
    limit: 2,
  };
  const row = (id: string, date: string): AttentionRecord =>
    ({ id, attentionDate: new Date(date) }) as Awaited<ReturnType<typeof repository.list>>[number];

  beforeEach(() => jest.resetAllMocks());

  it('requests one extra row and emits a stable next cursor', async () => {
    list.mockResolvedValue([
      row('11111111-1111-4111-8111-111111111111', '2026-08-03T00:00:00.000Z'),
      row('22222222-2222-4222-8222-222222222222', '2026-08-02T00:00:00.000Z'),
      row('33333333-3333-4333-8333-333333333333', '2026-08-01T00:00:00.000Z'),
    ]);
    const page = await useCase.execute(base);
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ limit: 3 }));
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeDefined();

    list.mockResolvedValue([]);
    await useCase.execute({ ...base, cursor: page.nextCursor });
    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cursor: {
          id: '22222222-2222-4222-8222-222222222222',
          attentionDate: new Date('2026-08-02T00:00:00.000Z'),
        },
      }),
    );
  });

  it('rejects a malformed cursor before querying persistence', async () => {
    await expect(useCase.execute({ ...base, cursor: 'not-a-cursor' })).rejects.toBeInstanceOf(
      InvalidAttentionError,
    );
    expect(list).not.toHaveBeenCalled();
  });
});
