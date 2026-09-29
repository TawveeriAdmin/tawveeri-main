import { parseProcessStatus, processAgeSeconds } from '../../scripts/worker/lib/process-snapshot';

it('distinguishes a multithreaded process from its parent and a zombie without reading arguments', () => {
  expect(parseProcessStatus('Name:\tchromium\nState:\tS (sleeping)\nPPid:\t42\nThreads:\t17\nVmRSS:\t12345 kB\n')).toEqual({ name: 'chromium', state: 'S', ppid: 42, threads: 17, rssKb: 12345 });
  expect(parseProcessStatus('Name:\tnode\nState:\tZ (zombie)\nPPid:\t1\nThreads:\t1\n')).toMatchObject({ state: 'Z', threads: 1, rssKb: 0 });
});

it('uses kernel clock ticks for age and tolerates spaces and parentheses in a process name', () => {
  const fields = Array(20).fill('0'); fields[0] = 'S'; fields[19] = '5000';
  const stat = `123 (worker (fixture)) ${fields.join(' ')}`;
  expect(processAgeSeconds(stat, 80, 100)).toBe(30);
  expect(processAgeSeconds(stat, 80, null)).toBeNull();
  expect(processAgeSeconds(stat, 1, 100)).toBeNull();
});
