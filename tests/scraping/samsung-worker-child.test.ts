import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { runSamsungWorkerChild } from '../../scripts/tps-core/samsung-worker-child';

jest.mock('child_process', () => ({ spawn: jest.fn() }));

describe('Samsung child execution preserves lease heartbeat scheduling', () => {
  afterEach(() => jest.useRealTimers());
  it('keeps timers running while awaiting a successful child', async () => {
    jest.useFakeTimers();
    const child = new EventEmitter();
    (spawn as jest.Mock).mockReturnValue(child);
    let beats = 0;
    const heartbeat = setInterval(() => beats++, 15000);
    const pending = runSamsungWorkerChild('worker.ts', ['--stores', '6']);
    jest.advanceTimersByTime(45000);
    expect(beats).toBe(3);
    child.emit('exit', 0, null);
    await expect(pending).resolves.toBeUndefined();
    clearInterval(heartbeat);
    expect(spawn).toHaveBeenCalledWith(process.execPath,
      ['--import', 'tsx', 'worker.ts', '--stores', '6'], { stdio: 'inherit' });
  });
  it('rejects a failed or terminated child instead of recording success', async () => {
    const child = new EventEmitter();
    (spawn as jest.Mock).mockReturnValue(child);
    const pending = runSamsungWorkerChild('worker.ts');
    child.emit('exit', null, 'SIGTERM');
    await expect(pending).rejects.toThrow('SIGTERM');
  });
});
