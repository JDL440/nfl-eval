/**
 * Mock Substack API
 *
 * In-process HTTP handler that simulates Substack's publication API.
 * Designed for E2E tests — no live network calls.
 *
 * Supported routes:
 *   POST   /api/v1/posts          — create draft or publish article
 *   DELETE /api/v1/posts/:id      — unpublish (revert to draft)
 *   GET    /api/v1/posts/:id      — fetch article (helper for assertions)
 *
 * Error simulation:
 *   Set `mockApi.nextError = { status, body }` before a request to force an error.
 *   Set `mockApi.simulateTimeout = true` to force a timeout on the next call.
 *   Set `mockApi.simulateRateLimit = true` to return 429.
 */

let nextId = 1000;

export function createMockSubstackApi() {
  const state = {
    /** @type {Map<string, object>} stored articles keyed by id */
    articles: new Map(),

    /** @type {Array<{method: string, path: string, body: object|null, timestamp: string}>} */
    requests: [],

    // ── Error simulation knobs ──────────────────────────────────
    /** Force next response to be an error `{ status: number, body: object }` */
    nextError: null,
    /** Force next response to time out (resolved with a never-settling promise) */
    simulateTimeout: false,
    /** Force next response to be 429 rate-limited */
    simulateRateLimit: false,
    /** Artificial latency in ms (0 = instant) */
    latencyMs: 0,
  };

  // ── Internal helpers ────────────────────────────────────────────

  function recordRequest(method, path, body) {
    state.requests.push({
      method,
      path,
      body: body ? JSON.parse(JSON.stringify(body)) : null,
      timestamp: new Date().toISOString(),
    });
  }

  function generateId() {
    return String(nextId++);
  }

  async function maybeDelay() {
    if (state.latencyMs > 0) {
      await new Promise((r) => setTimeout(r, state.latencyMs));
    }
  }

  function makeResponse(status, body, headers = {}) {
    const headerMap = new Map(Object.entries({
      'content-type': 'application/json',
      ...headers,
    }));
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: statusLabel(status),
      headers: { get: (key) => headerMap.get(key.toLowerCase()) || null },
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    };
  }

  function statusLabel(code) {
    const map = {
      200: 'OK', 201: 'Created', 204: 'No Content',
      400: 'Bad Request', 401: 'Unauthorized', 404: 'Not Found',
      429: 'Too Many Requests', 500: 'Internal Server Error',
    };
    return map[code] || 'Unknown';
  }

  // ── Route handlers ──────────────────────────────────────────────

  function handleCreatePost(body) {
    const id = generateId();
    const slug = (body.title || 'untitled').toLowerCase().replace(/\s+/g, '-').slice(0, 40);
    const isDraft = body.draft !== false;
    const now = new Date().toISOString();

    const article = {
      id: Number(id),
      title: body.title,
      body_markdown: body.body_markdown,
      subtitle: body.subtitle || '',
      slug,
      status: isDraft ? 'draft' : 'published',
      draft_url: `https://mock.substack.com/p/${slug}/edit`,
      canonical_url: isDraft ? null : `https://mock.substack.com/p/${slug}`,
      created_at: now,
      updated_at: now,
    };

    state.articles.set(id, article);
    return makeResponse(201, article);
  }

  function handleDeletePost(id) {
    const article = state.articles.get(id);
    if (!article) {
      return makeResponse(404, { error: `Article ${id} not found` });
    }
    article.status = 'draft';
    article.canonical_url = null;
    article.updated_at = new Date().toISOString();
    return makeResponse(200, article);
  }

  function handleGetPost(id) {
    const article = state.articles.get(id);
    if (!article) {
      return makeResponse(404, { error: `Article ${id} not found` });
    }
    return makeResponse(200, article);
  }

  // ── Main fetch handler ──────────────────────────────────────────

  /**
   * Drop-in replacement for `fetch`. Pass this as `fetchFn` to SubstackClient.
   */
  async function handler(url, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const parsedBody = options.body ? JSON.parse(options.body) : null;
    const pathname = new URL(url).pathname;

    recordRequest(method, pathname, parsedBody);
    await maybeDelay();

    // ── Error simulation (consumed on use) ──────────────────────
    if (state.simulateTimeout) {
      state.simulateTimeout = false;
      // Return a promise that never resolves — the caller's AbortController
      // will fire and produce a timeout error.
      return new Promise(() => {});
    }

    if (state.simulateRateLimit) {
      state.simulateRateLimit = false;
      return makeResponse(429, {
        error: 'Rate limit exceeded. Retry after 60 seconds.',
      }, { 'retry-after': '60' });
    }

    if (state.nextError) {
      const { status, body } = state.nextError;
      state.nextError = null;
      return makeResponse(status, body || { error: 'Simulated error' });
    }

    // ── Route matching ──────────────────────────────────────────
    const postIdMatch = pathname.match(/\/api\/v1\/posts\/(\d+)/);

    if (method === 'POST' && pathname === '/api/v1/posts') {
      return handleCreatePost(parsedBody);
    }

    if (method === 'DELETE' && postIdMatch) {
      return handleDeletePost(postIdMatch[1]);
    }

    if (method === 'GET' && postIdMatch) {
      return handleGetPost(postIdMatch[1]);
    }

    return makeResponse(404, { error: `Unknown route: ${method} ${pathname}` });
  }

  // ── Public API ──────────────────────────────────────────────────

  return {
    /** The fetch-compatible handler. */
    fetch: handler,

    /** Direct access to internal state for assertions. */
    get articles() { return state.articles; },
    get requests() { return [...state.requests]; },

    /** Find requests matching a filter. */
    findRequests(filter = {}) {
      return state.requests.filter((r) => {
        if (filter.method && r.method !== filter.method.toUpperCase()) return false;
        if (filter.path && !r.path.includes(filter.path)) return false;
        return true;
      });
    },

    /** Assert a specific request was made. Returns the matching request or throws. */
    assertCalledWith({ method, path, bodyContains }) {
      const matches = state.requests.filter((r) => {
        if (method && r.method !== method.toUpperCase()) return false;
        if (path && !r.path.includes(path)) return false;
        if (bodyContains && r.body) {
          for (const [key, val] of Object.entries(bodyContains)) {
            if (r.body[key] !== val) return false;
          }
        }
        return true;
      });
      if (matches.length === 0) {
        throw new Error(
          `Expected request ${method || '*'} ${path || '*'} with body containing ${JSON.stringify(bodyContains)} — not found.\n` +
          `Recorded requests: ${JSON.stringify(state.requests, null, 2)}`
        );
      }
      return matches[0];
    },

    /** Get the last recorded request. */
    get lastRequest() {
      return state.requests.length > 0 ? state.requests[state.requests.length - 1] : null;
    },

    // ── Error simulation setters ────────────────────────────────
    set nextError(val) { state.nextError = val; },
    set simulateTimeout(val) { state.simulateTimeout = val; },
    set simulateRateLimit(val) { state.simulateRateLimit = val; },
    set latencyMs(val) { state.latencyMs = val; },

    /** Reset all state (articles, requests, error flags). */
    reset() {
      state.articles.clear();
      state.requests.length = 0;
      state.nextError = null;
      state.simulateTimeout = false;
      state.simulateRateLimit = false;
      state.latencyMs = 0;
    },
  };
}

export default createMockSubstackApi;
