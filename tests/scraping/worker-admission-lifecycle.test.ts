import { createRestAdmission } from '../../scripts/worker/lib/rest-admission';
import { RunLifecycle } from '../../scripts/worker/lib/run-lifecycle';

describe('quota containment for dependent jobs', () => {
  it('shares a five minute 402 cooldown, then rechecks and resumes on recovery', async () => {
    let now = 0;
    const request = jest.fn().mockResolvedValue({ ok: false, status: 402 });
    const admit = createRestAdmission(request, () => now);
    expect(await admit('refresh', 'https://database.example', 'fixture')).toEqual({ allowed: false, reason: 'quota' });
    expect(await admit('price_update', 'https://database.example', 'fixture')).toEqual({ allowed: false, reason: 'quota' });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][1]).toMatchObject({ method: 'HEAD', redirect: 'error' });
    expect(String(request.mock.calls[0][0])).toBe('https://database.example/rest/v1/stores?select=id&limit=1');
    now = 300000;
    request.mockResolvedValue({ ok: true, status: 200 });
    expect(await admit('refresh', 'https://database.example', 'fixture')).toEqual({ allowed: true, reason: 'ready' });
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('does not pause independent feed jobs or contact REST for them', async () => {
    const request = jest.fn();
    const admit = createRestAdmission(request);
    expect(await admit('feed_ingest')).toEqual({ allowed: true, reason: 'independent' });
    expect(request).not.toHaveBeenCalled();
  });
  it('fails closed for timeout and missing configuration without exposing the error', async () => {
    const admit = createRestAdmission(jest.fn().mockRejectedValue(new Error('private dependency detail')));
    expect(await admit('refresh')).toEqual({ allowed: false, reason: 'unconfigured' });
    expect(await admit('refresh', 'https://database.example', 'fixture')).toEqual({ allowed: false, reason: 'unavailable' });
  });
  it('does not reuse a restriction for a different project', async () => {
    const request = jest.fn().mockResolvedValueOnce({ ok: false, status: 402 }).mockResolvedValueOnce({ ok: true, status: 200 });
    const admit = createRestAdmission(request);
    await admit('refresh', 'https://first.example', 'fixture');
    expect((await admit('refresh', 'https://second.example', 'fixture')).allowed).toBe(true);
  });
});

describe('worker shutdown lifetime', () => {
  it('retains the slot until child termination and lock release complete', async () => {
    const life = new RunLifecycle();
    const events: string[] = [];
    let childExit!: () => void;
    const exited = new Promise<void>(resolve => { childExit = resolve; });
    const running = life.run(async () => { events.push('spawn'); await exited; events.push('release-lock'); });
    await Promise.resolve();
    await life.run(async () => { events.push('overlap'); });
    let stopped = false;
    const stop = life.stop(() => events.push('cancel')).then(() => { stopped = true; events.push('exit-worker'); });
    await Promise.resolve();
    expect(stopped).toBe(false);
    await life.run(async () => { events.push('spawn-after-stop'); });
    childExit();
    await Promise.all([running, stop]);
    expect(events).toEqual(['spawn', 'cancel', 'release-lock', 'exit-worker']);
  });
  it('releases an unsuccessful execution slot for the next ordinary job', async () => {
    const life = new RunLifecycle();
    await expect(life.run(async () => { throw new Error('fixture'); })).rejects.toThrow('fixture');
    const work = jest.fn().mockResolvedValue(undefined);
    await life.run(work);
    expect(work).toHaveBeenCalledTimes(1);
  });
});
