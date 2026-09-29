/** @jest-environment jsdom */
import { track } from '@/lib/analytics/track';

test('adjacent home steps remain distinct while identical repeated events are suppressed', () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
  for (const step of ['started', 'reviewed', 'reviewed', 'plan']) track('home_mission', { source: 'fridge_results', meta: { step, mode: 'personal' } });
  expect(fetch).toHaveBeenCalledTimes(3);
  const payloads = (fetch as jest.Mock).mock.calls.map(call => JSON.parse(call[1].body));
  expect(payloads.map(p => p.meta.step)).toEqual(['started', 'reviewed', 'plan']);
  expect(payloads.every(p => p.source === 'fridge_results' && !p.query_text)).toBe(true);
});
