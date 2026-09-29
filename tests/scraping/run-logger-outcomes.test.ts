import { finishRun } from '@/lib/scraping/services/run-logger';

let mockError: unknown = null;
const mockWrites: Array<{ table: string; value: Record<string, unknown> }> = [];
jest.mock('@/lib/database', () => ({ createServerClient: () => ({ from: (table: string) => {
  const q: any = {
    select: () => q, eq: () => q,
    single: async () => ({ data: { started_at: '2026-09-29T00:00:00Z', schedule_id: 'schedule' }, error: null }),
    update: (value: Record<string, unknown>) => { mockWrites.push({ table, value }); return q; },
    then: (resolve: (r: unknown) => unknown) => Promise.resolve({ error: mockError }).then(resolve),
  }; return q;
} }) }));

describe('run ledger preserves business success semantics', () => {
  beforeEach(() => { mockError = null; mockWrites.length = 0; });
  it.each(['partial', 'failed'] as const)('%s advances attempt time but never schedule success time', async status => {
    expect(await finishRun({ run_id: 1, status, products_updated: 1 })).toBe(true);
    expect(mockWrites.find(w => w.table === 'scraping_schedules')?.value).toEqual({ last_run_at: expect.any(String) });
  });
  it('clean success advances the schedule success time', async () => {
    await finishRun({ run_id: 1, status: 'success' });
    expect(mockWrites.find(w => w.table === 'scraping_schedules')?.value).toHaveProperty('last_success_at');
  });
  it('a rejected run update cannot mark the schedule successful', async () => {
    mockError = { message: 'fixture rejected write' };
    expect(await finishRun({ run_id: 1, status: 'success' })).toBe(false);
    expect(mockWrites.some(w => w.table === 'scraping_schedules')).toBe(false);
  });
});
