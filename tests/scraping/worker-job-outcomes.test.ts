import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { runGuarded } from '../../scripts/worker/lib/proc-guard';
import { aggregateJobOutcomes, jobExitCode, PARTIAL_JOB_EXIT_CODE } from '../../scripts/worker/lib/job-outcome';

jest.mock('child_process', () => ({ spawn: jest.fn() }));
describe('worker child outcome propagation', () => {
  it('all failed stores cannot become success; mixed outcomes remain partial', () => {
    expect(aggregateJobOutcomes(['failed', 'spawn_error', 'timeout'])).toBe('failed');
    expect(aggregateJobOutcomes(['success', 'failed'])).toBe('partial');
    expect(aggregateJobOutcomes(['partial', 'failed'])).toBe('partial');
    expect(aggregateJobOutcomes(['success', 'success'])).toBe('success');
    expect(aggregateJobOutcomes(['success', 'cancelled'])).toBe('cancelled');
    expect(jobExitCode('partial')).toBe(PARTIAL_JOB_EXIT_CODE);
    expect(jobExitCode('failed')).not.toBe(0);
  });
  it.each([false, true])('only an opted-in child may use the partial exit code: %s', async enabled => {
    const child = new EventEmitter();
    (spawn as jest.Mock).mockReturnValue(child);
    const guarded = runGuarded('fixture', [], { timeoutMs: 1000, jobName: 'fixture', partialExitCode: enabled ? PARTIAL_JOB_EXIT_CODE : undefined });
    child.emit('close', PARTIAL_JOB_EXIT_CODE, null);
    expect((await guarded.result).outcome).toBe(enabled ? 'partial' : 'failed');
    expect((spawn as jest.Mock).mock.calls.at(-1)?.[2]).not.toHaveProperty('partialExitCode');
  });
});
