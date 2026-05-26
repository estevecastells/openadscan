/**
 * fetch wrapper with retry/backoff. Used by all connector clients.
 */

export type RetryableFetchInit = RequestInit & {
  retries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
};

export async function fetchWithRetry(input: string, init: RetryableFetchInit = {}): Promise<Response> {
  const retries = init.retries ?? 3;
  const baseDelay = init.baseDelayMs ?? 400;
  const timeout = init.timeoutMs ?? 30_000;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(input, { ...init, signal: controller.signal });
      if (res.status >= 500 || res.status === 429) {
        // retry on transient errors
        if (attempt === retries) return res;
      } else {
        return res;
      }
    } catch (err) {
      lastErr = err;
      if (attempt === retries) throw err;
    } finally {
      clearTimeout(t);
    }
    // jittered backoff
    const delay = baseDelay * 2 ** attempt + Math.random() * baseDelay;
    await new Promise((r) => setTimeout(r, delay));
  }
  throw lastErr ?? new Error("fetchWithRetry: exhausted");
}
