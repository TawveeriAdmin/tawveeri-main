import { collectCanonicalCandidates } from '../../src/lib/search/canonical-candidates';

describe('canonical candidate pagination before relevance filtering', () => {
  it('examines a relevant product beyond the response cap', async () => {
    const first = Array.from({ length: 1000 }, (_, id) => ({ id }));
    const page = jest.fn().mockResolvedValueOnce({ data: first, error: null })
      .mockResolvedValueOnce({ data: [{ id: 1001 }], error: null });
    expect((await collectCanonicalCandidates(page)).map(row => (row as { id: number }).id)).toContain(1001);
    expect(page).toHaveBeenNthCalledWith(2, 1000, 1999);
  });
  it('does not silently accept a truncated set when a later page fails', async () => {
    const page = jest.fn().mockResolvedValueOnce({ data: Array(1000).fill({}), error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'unavailable' } });
    await expect(collectCanonicalCandidates(page)).rejects.toThrow('unavailable');
  });
});
