import { readFileSync } from 'fs';
import { resolve } from 'path';
import { runInNewContext } from 'vm';
import { EventEmitter } from 'events';

describe('Samsung scheduling after an observed spawn EAGAIN', () => {
  afterEach(() => jest.useRealTimers());
  it('retries a failed spawn once after delay, while preserving due and pressure gates', async () => {
    jest.useFakeTimers();
    const source = readFileSync(resolve(process.cwd(), 'scripts/scheduler.js'), 'utf8');
    const section = source.slice(source.indexOf('const SAMSUNG_DELTA_WATCH_MS'), source.indexOf("process.on('SIGTERM'"));
    const children: EventEmitter[] = [];
    const spawn = jest.fn(() => { const child: any = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); children.push(child); return child; });
    const context: any = { process: { env: {}, execPath: 'node', cwd: () => '/app' }, setTimeout, clearTimeout, setInterval: jest.fn(),
      console: { log: jest.fn(), error: jest.fn() }, pressureOk: jest.fn().mockResolvedValue(true), jobDue: jest.fn().mockResolvedValue(true),
      jobDone: jest.fn(), spawn, samsungDeltaWatchRunning: false, refreshRunning: false, feedIngestRunning: false, ingestRunning: false,
      INGEST_FIRST_DELAY_MS: 1200000, jitterMs: () => 0,
      require: (name: string) => name.includes('runtime-resources') ? { samsungRuntimeResources: () => ({}) }
        : { resolveSamsungDeltaRuntime: () => ({ cwd: '/app', script: '/app/worker.ts' }) } };
    runInNewContext(`${section}\nglobalThis.run = runSamsungDeltaWatch;`, context);
    await context.run();
    children[0].emit('error', new Error('EAGAIN'));
    children[0].emit('close', -11);
    expect(context.jobDone).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(context.pressureOk).toHaveBeenCalledTimes(2);
    children[1].emit('close', 0);
    expect(context.jobDone).toHaveBeenCalledWith('samsung-delta-watch', 'ok');
  });
});
