jest.mock('@/app/api/v1/agent/home-mission/route', () => ({ POST: jest.fn() }));
import { POST } from '@/app/api/v1/agent/home-mission/route';
import { GET } from '@/app/api/v1/agent/home-mission/example/route';

test('example reuses real engine output, coalesces concurrent reads and expires without stale fallback', async () => {
  const now = jest.spyOn(Date, 'now').mockReturnValue(1000000);
  (POST as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ state: 'partial', legs: [], allocation: { total_allocated: 0 } }) });
  const [first, second] = await Promise.all([GET(), GET()]);
  expect(POST).toHaveBeenCalledTimes(1);
  expect(await first.json()).toEqual(await second.json());
  const request = (POST as jest.Mock).mock.calls[0][0];
  expect((await request.json()).mission.quantities).toEqual({ air_conditioner: 2, refrigerator: 1, washing_machine: 1 });
  await GET(); expect(POST).toHaveBeenCalledTimes(1);
  now.mockReturnValue(1400000);
  (POST as jest.Mock).mockResolvedValue({ ok: false });
  expect((await GET()).status).toBe(503);
  now.mockRestore();
});
