// Shared PostgREST pagination helper (ADR-285).
//
// A bare `.limit(n)` on a Supabase/PostgREST query is NOT a request the server honors past
// its own `db-max-rows` project setting — the platform default is 1000, and a query whose
// real match count exceeds it is silently truncated to exactly 1000 rows, with `error: null`.
// No exception is thrown; the caller cannot tell the difference between "there are exactly
// 1000 matching rows" and "there are many more and this is a truncated slice." A query with
// no `.order()` on top of that returns a non-deterministic 1000-row slice, so the same query
// can produce different results on successive page loads.
//
// First found and fixed in ADR-172 (the retailers page undercounted a table by ~18x because
// of exactly this). That fix was applied locally to the one file it was found in and never
// generalized, so the identical defect reappeared independently in
// src/lib/admin/command-center-queries.ts (silently capping the Founder Command Center's
// "confirmed retailer redirects" and several other headline numbers at 1000) and in five
// other call sites — see ADR-285 for the full list and root-cause discussion.
//
// THE RULE (also stated in CLAUDE.md): any Supabase query whose result feeds a founder-facing
// number, a customer-facing count/list that must be complete, or any other COUNT a human will
// quote, MUST use `fetchAllPaginated()` (or hand-rolled `.range()` pagination with the same
// discipline) instead of a bare `.limit()`. A `.limit()` capped comfortably below `pageSize`
// for a genuinely small, intentionally-bounded result (a "recent N items" list, an autocomplete
// dropdown) is fine and out of scope — the risk is specifically an unbounded "give me
// everything matching this filter" query dressed up as a large `.limit()`.
//
// The caller is responsible for adding a deterministic `.order()` (a primary key or another
// column guaranteed unique/stable across rows) to its query before `.range()` — pagination
// over an unordered result set is exactly as unstable as a single unordered `.limit()`.

export interface PaginatedPage<T> {
  data: T[] | null;
  error: { message: string } | null;
}

export interface PaginatedFetchOptions {
  /** Rows requested per page. Default 1000, matching this project's current db-max-rows —
   *  tuned for round-trip count, not required for correctness (see the termination note
   *  below: a page short of `pageSize` is never trusted as "the last page" on its own). */
  pageSize?: number;
  /** Hard safety ceiling across all pages, so a runaway filter cannot page forever. Default
   *  100,000 — comfortably above every known table's current real-data volume in this
   *  codebase (see ADR-285's measured counts). FAIL-CLOSED: reaching this ceiling THROWS
   *  rather than returning the rows accumulated so far — an internal safety ceiling that
   *  silently returned a partial dataset would itself be a second, undetectable truncation
   *  mechanism, defeating the entire point of this helper. If this is ever hit legitimately
   *  (real volume has genuinely grown past the ceiling), raise `maxRows` deliberately; it
   *  must never be worked around by swallowing the error. */
  maxRows?: number;
}

/**
 * Fetches every row matching a query by looping `.range()` pages.
 *
 * TERMINATION INVARIANT — deliberately NOT "stop when a page returns fewer than `pageSize`
 * rows". That heuristic silently breaks if the server's own row cap (PostgREST's
 * `db-max-rows`) is ever lower than the `pageSize` this helper requests: a page would then
 * come back short of `pageSize` for a reason OTHER than genuinely being the last page, and
 * stopping there would silently drop the remaining rows — reintroducing this exact ADR-172/
 * ADR-285 defect at a new threshold instead of fixing it. Instead:
 *
 *   1. `from` always advances by the ACTUAL number of rows the last page returned, never by
 *      the nominal `pageSize` requested. This means a page short of `pageSize` for ANY
 *      reason (including a lowered `db-max-rows`) cannot create a gap — the next request
 *      simply starts exactly where the last one's data ended.
 *   2. The loop stops ONLY when a page returns zero rows, or once `maxRows` (a safety
 *      ceiling, not a correctness mechanism) is reached.
 *
 * This costs at most one extra round trip per call (an explicit empty final page) versus the
 * old short-page heuristic, in exchange for correctness that no longer depends on `pageSize`
 * being tuned to match the server's cap — it is correct even if that cap changes, is lower
 * than requested, or the server enforces some other undocumented ceiling.
 *
 * FAILURE SAFETY — `fetchPage(from, to)` must apply `.range(from, to)` to an already-ordered
 * query and return `{ data, error }`, the same shape a Supabase query awaits to. An error on
 * ANY page — including a later page after earlier pages already succeeded — throws
 * immediately; the rows accumulated so far are discarded with the rejected promise, never
 * returned as if they were the complete set. There is no retry and no partial-success path.
 * Reaching `maxRows` is treated the same way: it THROWS rather than returning the partial
 * accumulation, because there is no way to know whether more rows remain — silently
 * returning what was gathered so far would make `maxRows` itself a second, harder-to-notice
 * truncation mechanism, exactly what this helper exists to eliminate.
 */
export async function fetchAllPaginated<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PaginatedPage<T>>,
  options: PaginatedFetchOptions = {}
): Promise<T[]> {
  const pageSize = options.pageSize ?? 1000;
  const maxRows = options.maxRows ?? 100_000;
  const out: T[] = [];
  let from = 0;
  for (;;) {
    const to = from + pageSize - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    if (rows.length === 0) break;
    out.push(...rows);
    if (out.length >= maxRows) {
      throw new Error(
        `fetchAllPaginated: reached the maxRows safety ceiling (${maxRows}) with more rows ` +
          `possibly still remaining — refusing to return a partial dataset as if it were ` +
          `complete. Raise maxRows if this volume is now genuinely expected.`
      );
    }
    from += rows.length; // advance by what was actually returned, never the nominal pageSize
  }
  return out;
}
