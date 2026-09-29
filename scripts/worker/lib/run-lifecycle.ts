/** The running job owns its lock through child termination and finalization. */
export class RunLifecycle {
  private current: Promise<void> | null = null;
  stopping = false;

  async run(work: () => Promise<void>): Promise<void> {
    if (this.stopping || this.current) return;
    // Reserve the slot before invoking work, including a synchronous throw.
    const current = Promise.resolve().then(work);
    this.current = current;
    try { await current; } finally { this.current = null; }
  }

  async stop(cancel: () => void): Promise<void> {
    this.stopping = true;
    cancel();
    await this.current;
  }
}
