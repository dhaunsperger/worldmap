/**
 * Supabase occasionally rejects a fresh session with "JWT issued at future
 * time" — clock skew between its auth server and API gateway, transient by
 * nature. Retry once after a beat before surfacing the error.
 */
const CLOCK_SKEW_RE = /issued at|in the future/i

export async function retryClockSkew<R extends { error: { message: string } | null }>(
  run: () => PromiseLike<R>,
): Promise<R> {
  const first = await run()
  if (first.error && CLOCK_SKEW_RE.test(first.error.message)) {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    return run()
  }
  return first
}
