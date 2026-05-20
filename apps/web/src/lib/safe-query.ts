/**
 * Small helper: run a DB-bound query, but if the connection fails
 * (e.g. local dev without Postgres running), return a fallback and
 * surface an in-page banner instead of a hard 500.
 */
export type SafeResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export async function safe<T>(fn: () => Promise<T>): Promise<SafeResult<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
