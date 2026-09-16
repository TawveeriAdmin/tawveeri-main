import { spawn } from 'child_process';

/** Await child completion without blocking the parent's database lease heartbeat. */
export function runSamsungWorkerChild(script: string, args: string[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', script, ...args], { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Samsung child ${script} failed: ${signal || code}`));
    });
  });
}
