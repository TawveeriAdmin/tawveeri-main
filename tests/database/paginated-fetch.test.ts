// tests/database/paginated-fetch.test.ts — ADR-285: PostgREST silently truncates any
// single response at its db-max-rows setting (1000 on this project) regardless of a
// requested `.limit()`, with no error. fetchAllPaginated() is the shared fix (generalizing
// ADR-172's one-off pagination pattern) — these tests prove it never returns fewer rows
// than actually match, never returns partial data as complete on a later-page failure, and
// never depends on the server's row cap matching the requested page size.
import { fetchAllPaginated } from "@/lib/database/paginated-fetch";

/** A fake PostgREST-shaped backend: `cap` simulates the server's own db-max-rows — it can
 *  never return more than `cap` rows per call, REGARDLESS of the (from, to) window
 *  requested, exactly like a real project whose db-max-rows is lower than expected. */
function fakeBackend(total: number, cap = 1000) {
  const allRows = Array.from({ length: total }, (_, i) => i);
  const calls: Array<{ from: number; to: number }> = [];
  const fetchPage = async (from: number, to: number) => {
    calls.push({ from, to });
    const requested = Math.min(to - from + 1, cap);
    const data = allRows.slice(from, from + requested);
    return { data, error: null as { message: string } | null };
  };
  return { fetchPage, calls };
}

describe("fetchAllPaginated — exact failure-class boundaries (ADR-285)", () => {
  it("999 rows — a single page, no truncation, no unnecessary extra request beyond the trailing empty check", async () => {
    const { fetchPage, calls } = fakeBackend(999);
    const rows = await fetchAllPaginated<number>(fetchPage, { pageSize: 1000 });
    expect(rows).toHaveLength(999);
    expect(rows).toEqual(Array.from({ length: 999 }, (_, i) => i));
    // page 1 returns 999 (< pageSize, but NOT trusted as "last" by count alone) — a second,
    // empty page confirms termination. Exactly 2 calls: no gap, no infinite loop.
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual({ from: 999, to: 1998 });
  });

  it("1000 rows — exactly one full page — the precise value that silently broke the old .limit(20000) code", async () => {
    const { fetchPage, calls } = fakeBackend(1000);
    const rows = await fetchAllPaginated<number>(fetchPage, { pageSize: 1000 });
    expect(rows).toHaveLength(1000); // NOT truncated, NOT mistaken for "less than expected"
    expect(rows[999]).toBe(999);
    expect(calls).toHaveLength(2); // full page, then a confirming empty page
  });

  it("1001 rows — one row past the cap — the exact boundary the founder's original bug crossed", async () => {
    const { fetchPage, calls } = fakeBackend(1001);
    const rows = await fetchAllPaginated<number>(fetchPage, { pageSize: 1000 });
    expect(rows).toHaveLength(1001); // the old bare `.limit()` code would have returned 1000
    expect(rows[1000]).toBe(1000);
    // page 1: 1000 rows (full, continues) — page 2: 1 row (still not empty, continues) —
    // page 3: 0 rows (stops). A short-page-only heuristic would have wrongly stopped at
    // page 2 believing 1 row < pageSize meant "done" — it does here, correctly, only because
    // page 3 is what actually confirms it, not the row count of page 2 alone.
    expect(calls).toHaveLength(3);
    expect(calls[1]).toEqual({ from: 1000, to: 1999 });
    expect(calls[2]).toEqual({ from: 1001, to: 2000 });
  });

  it(">2000 rows (2,500) — multi-page aggregation across a partial final page", async () => {
    const { fetchPage, calls } = fakeBackend(2500);
    const rows = await fetchAllPaginated<number>(fetchPage, { pageSize: 1000 });
    expect(rows).toHaveLength(2500);
    expect(rows[0]).toBe(0);
    expect(rows[2499]).toBe(2499);
    // 1000 + 1000 + 500 + empty confirmation = 4 calls
    expect(calls).toHaveLength(4);
  });

  it("deterministic, gapless pagination even when the server's own cap is LOWER than the requested page size (db-max-rows lowered)", async () => {
    // Simulates the exact scenario CLAUDE.md/ADR-285 flag as the residual risk of a naive
    // "stop on short page" implementation: db-max-rows=300 while pageSize requests 1000.
    // A `from += pageSize` implementation would skip rows 300-999 on the first advance.
    const { fetchPage, calls } = fakeBackend(950, /* cap */ 300);
    const rows = await fetchAllPaginated<number>(fetchPage, { pageSize: 1000 });
    expect(rows).toHaveLength(950); // complete — no gap despite every page being short of pageSize
    expect(rows).toEqual(Array.from({ length: 950 }, (_, i) => i));
    // Confirms `from` advanced by the ACTUAL 300 rows returned, not the nominal 1000.
    expect(calls[0]).toEqual({ from: 0, to: 999 });
    expect(calls[1]).toEqual({ from: 300, to: 1299 });
    expect(calls[2]).toEqual({ from: 600, to: 1599 });
    expect(calls[3]).toEqual({ from: 900, to: 1899 }); // returns the last 50 rows (cap not hit)
    expect(calls[4]).toEqual({ from: 950, to: 1949 }); // confirming empty page
    expect(calls).toHaveLength(5);
  });

  it("a later-page failure (page 2) does NOT return the first page's rows as if they were the complete set", async () => {
    let call = 0;
    const fetchPage = jest.fn(async () => {
      call++;
      if (call === 1) return { data: Array.from({ length: 1000 }, (_, i) => i), error: null };
      return { data: null, error: { message: "connection reset on page 2" } };
    });
    await expect(fetchAllPaginated<number>(fetchPage, { pageSize: 1000 })).rejects.toThrow(
      "connection reset on page 2"
    );
    expect(fetchPage).toHaveBeenCalledTimes(2); // page 1 succeeded, page 2 failed, no retry
  });

  it("a later-page failure (page 3) does NOT return pages 1-2's rows as if they were the complete set", async () => {
    let call = 0;
    const fetchPage = jest.fn(async () => {
      call++;
      if (call <= 2) return { data: Array.from({ length: 1000 }, (_, i) => i), error: null };
      return { data: null, error: { message: "boom on page 3" } };
    });
    await expect(fetchAllPaginated<number>(fetchPage, { pageSize: 1000 })).rejects.toThrow(
      "boom on page 3"
    );
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it("stops as soon as an empty page is returned, without an extra trailing request", async () => {
    const fetchPage = jest.fn(async (from: number) => ({
      data: from === 0 ? Array(1000).fill(0) : from === 1000 ? [1, 2] : [],
      error: null,
    }));
    const rows = await fetchAllPaginated<number>(fetchPage, { pageSize: 1000 });
    expect(rows).toHaveLength(1002);
    expect(fetchPage).toHaveBeenCalledTimes(3); // full page, short page, confirming empty page
  });

  it("throws (never silently swallows) a first-page error", async () => {
    const fetchPage = jest.fn(async () => ({ data: null, error: { message: "boom" } }));
    await expect(fetchAllPaginated<number>(fetchPage)).rejects.toThrow("boom");
  });

  it("treats a null data page as empty (terminates), rather than throwing", async () => {
    const fetchPage = jest.fn(async () => ({ data: null, error: null }));
    await expect(fetchAllPaginated<number>(fetchPage)).resolves.toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("FAIL-CLOSED: reaching maxRows THROWS instead of returning the accumulated rows as if complete", async () => {
    // A pathological (or simply much larger than expected) backend that never returns an
    // empty page. The old implementation silently `break`d here and returned a partial
    // array — making its own safety ceiling a second, undetectable truncation mechanism,
    // exactly what ADR-285 exists to eliminate. It must throw, not return partial data.
    const fetchPage = jest.fn(async (from: number) => ({
      data: Array(10).fill(0).map((_, i) => from + i), // always a full page — would loop forever
      error: null,
    }));
    await expect(
      fetchAllPaginated<number>(fetchPage, { pageSize: 10, maxRows: 25 })
    ).rejects.toThrow(/maxRows/i);
  });

  it("defaults pageSize to 1000 (PostgREST's own db-max-rows) for the first request", async () => {
    let capturedTo = -1;
    const fetchPage = jest.fn(async (from: number, to: number) => {
      capturedTo = to;
      return { data: [], error: null };
    });
    await fetchAllPaginated<number>(fetchPage);
    expect(capturedTo).toBe(999); // range(0, 999) = exactly 1000 rows requested
  });
});
