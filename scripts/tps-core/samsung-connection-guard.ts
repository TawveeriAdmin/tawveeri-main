/** Losing the singleton connection loses the writer lease. Never reconnect and
 * silently continue writes. Keep idle source-reading sessions alive, record the
 * failure, and let the caller stop at its next boundary before any new write. */
export function guardSamsungConnections(clients: Array<{
  on: (event: string, listener: (error: Error) => void) => unknown;
  query: (sql: string) => Promise<unknown>;
}>) {
  let failure: Error | null = null;
  const fail = (error: Error) => { failure ??= error; };
  for (const client of clients) client.on('error', fail);
  const timer = setInterval(() => {
    if (!failure) for (const client of clients) void client.query('select 1').catch(fail);
  }, 15000);
  timer.unref?.();
  return {
    assertHealthy() { if (failure) throw new Error(`Samsung database lease lost: ${failure.message}`); },
    close() { clearInterval(timer); },
  };
}
