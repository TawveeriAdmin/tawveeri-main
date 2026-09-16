/** PostgREST caps a response at 1,000 rows. Page the active category set before
 * applying query-word relevance, otherwise newer identities are never examined. */
export async function collectCanonicalCandidates<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const result = await page(from, from + 999);
    if (result.error) throw new Error(result.error.message);
    rows.push(...(result.data || []));
    if (!result.data || result.data.length < 1000) return rows;
  }
}
