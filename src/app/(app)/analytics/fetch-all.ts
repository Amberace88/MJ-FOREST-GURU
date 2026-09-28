import "server-only";

type PageResult<T> = { data: T[] | null; error: { message?: string; code?: string } | null };

/**
 * PostgREST caps responses (Supabase default 1000 rows). Pages through a query
 * built by `page(from, to)` until exhausted or `cap` rows are collected.
 */
export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<PageResult<T>>, cap = 20000, size = 1000) {
  const out: T[] = [];
  for (let offset = 0; offset < cap; offset += size) {
    const { data, error } = await page(offset, Math.min(offset + size, cap) - 1);
    if (error) return { rows: out, error, truncated: false };
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < size) return { rows: out, error: null, truncated: false };
  }
  return { rows: out, error: null, truncated: true };
}
