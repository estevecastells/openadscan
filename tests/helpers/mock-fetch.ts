/**
 * Tiny fetch-mocker. Registers URL→handler bindings for the duration of a test.
 *
 *   const { restore } = mockFetch({
 *     "GET https://example.com/x": () => json({ hello: "world" }),
 *   });
 *   // ... run code under test
 *   restore();
 *
 * Use `match:` prefix or pass a RegExp key to match partials.
 */
type Handler = (req: Request) => Response | Promise<Response>;

export function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

export function text(body: string, init: ResponseInit = {}): Response {
  return new Response(body, { status: 200, ...init });
}

export function status(code: number, body: string = ""): Response {
  return new Response(body, { status: code });
}

export function mockFetch(routes: Record<string, Handler>): { restore: () => void; calls: { url: string; method: string; body?: unknown }[] } {
  const orig = globalThis.fetch;
  const calls: { url: string; method: string; body?: unknown }[] = [];

  const entries = Object.entries(routes);
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input, init);
    const method = req.method.toUpperCase();
    const url = req.url;
    let bodyClone: unknown = undefined;
    try {
      bodyClone = init?.body ?? (await req.clone().text());
    } catch {
      /* ignore */
    }
    calls.push({ url, method, body: bodyClone });

    for (const [key, handler] of entries) {
      const [m, ...rest] = key.split(" ");
      if (!rest.length) continue;
      const pattern = rest.join(" ");
      if (m && m !== "*" && m !== method) continue;
      if (pattern.startsWith("match:")) {
        if (url.includes(pattern.slice("match:".length))) return handler(req);
      } else if (pattern.startsWith("regex:")) {
        if (new RegExp(pattern.slice("regex:".length)).test(url)) return handler(req);
      } else if (url === pattern) {
        return handler(req);
      }
    }
    throw new Error(`Unhandled fetch in test: ${method} ${url}`);
  }) as typeof fetch;

  return {
    calls,
    restore: () => {
      globalThis.fetch = orig;
    },
  };
}
