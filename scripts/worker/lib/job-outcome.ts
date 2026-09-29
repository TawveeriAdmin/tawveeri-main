import type { JobOutcome } from './proc-guard';

// Opt-in contract for our price jobs only. Generic subprocess exit 2 remains failure.
export const PARTIAL_JOB_EXIT_CODE = 2;

export function aggregateJobOutcomes(outcomes: JobOutcome[]): JobOutcome {
  if (outcomes.includes('cancelled')) return 'cancelled';
  if (outcomes.every(o => o === 'success')) return 'success';
  if (outcomes.some(o => o === 'success' || o === 'partial')) return 'partial';
  return 'failed';
}

export function jobExitCode(outcome: JobOutcome): number {
  return outcome === 'success' ? 0 : outcome === 'partial' ? PARTIAL_JOB_EXIT_CODE : 1;
}
