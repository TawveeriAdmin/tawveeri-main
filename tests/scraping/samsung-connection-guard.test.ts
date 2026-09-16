import { EventEmitter } from 'events';
import { guardSamsungConnections } from '../../scripts/tps-core/samsung-connection-guard';

describe('Samsung database lease guard', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  const client = () => Object.assign(new EventEmitter(), { query: jest.fn().mockResolvedValue({}) });
  it('keeps both source-reading connections alive and stops heartbeats on cleanup', async () => {
    const lock = client(), writer = client();
    const guard = guardSamsungConnections([lock, writer]);
    await jest.advanceTimersByTimeAsync(15000);
    expect(lock.query).toHaveBeenCalledWith('select 1');
    expect(writer.query).toHaveBeenCalledWith('select 1');
    guard.close();
    await jest.advanceTimersByTimeAsync(30000);
    expect(lock.query).toHaveBeenCalledTimes(1);
  });
  it('fails closed after singleton connection loss rather than silently reconnecting', () => {
    const lock = client(); const guard = guardSamsungConnections([lock]);
    lock.emit('error', new Error('Connection terminated unexpectedly'));
    expect(() => guard.assertHealthy()).toThrow('database lease lost');
    expect(lock.query).not.toHaveBeenCalled();
    guard.close();
  });
  it('also fails closed on an unsuccessful heartbeat', async () => {
    const lock = client(); lock.query.mockRejectedValue(new Error('connection closed'));
    const guard = guardSamsungConnections([lock]);
    await jest.advanceTimersByTimeAsync(15000);
    expect(() => guard.assertHealthy()).toThrow('connection closed');
    guard.close();
  });
});
