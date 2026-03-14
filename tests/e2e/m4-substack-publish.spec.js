/**
 * M4 E2E Test Suite — Substack Publish Flow
 *
 * Validates the full lifecycle: approve → publish → dashboard update.
 * All Substack API calls are mocked via mock-substack-api.
 *
 * Test status:
 *   ✅ Scaffold tests  — verify mock API + fixtures work (run now)
 *   ⏳ Pending tests   — placeholders for flows that need B1 (backend) + F1 (frontend)
 *
 * Coverage target: >90% of mock API surface.
 */

import { createMockSubstackApi } from '../mocks/mock-substack-api.js';
import MOCK_ARTICLES, {
  toPublishPayload,
  allArticles,
  totalCostCents,
  estimateCost,
  TOKEN_COSTS,
} from '../fixtures/mock-articles.js';

// ── Shared setup ──────────────────────────────────────────────────

let mockApi;

beforeEach(() => {
  mockApi = createMockSubstackApi();
});

afterEach(() => {
  mockApi.reset();
});

// ── Helper: call mock API directly (no SubstackClient dependency) ─

async function postArticle(article, isDraft = true) {
  const response = await mockApi.fetch(
    'https://mock.substack.com/api/v1/posts',
    {
      method: 'POST',
      body: JSON.stringify({
        title: article.title,
        body_markdown: article.body,
        subtitle: article.subtitle || '',
        draft: isDraft,
      }),
    }
  );
  return { response, body: await response.json() };
}

// ══════════════════════════════════════════════════════════════════
// Section 1 — Mock API & Fixture Validation (run now)
// ══════════════════════════════════════════════════════════════════

describe('Mock Substack API — core routes', () => {
  it('creates a draft article and returns expected shape', async () => {
    const { response, body } = await postArticle(MOCK_ARTICLES.breakingNews, true);

    expect(response.status).toBe(201);
    expect(body.id).toBeDefined();
    expect(body.status).toBe('draft');
    expect(body.draft_url).toContain('/edit');
    expect(body.canonical_url).toBeNull();
  });

  it('publishes an article live and returns published URL', async () => {
    const { response, body } = await postArticle(MOCK_ARTICLES.analysis, false);

    expect(response.status).toBe(201);
    expect(body.id).toBeDefined();
    expect(body.status).toBe('published');
    expect(body.canonical_url).toContain('mock.substack.com/p/');
    expect(body.draft_url).toContain('/edit');
  });

  it('unpublishes an article (DELETE → reverts to draft)', async () => {
    const { body: published } = await postArticle(MOCK_ARTICLES.breakingNews, false);
    expect(published.status).toBe('published');

    const deleteResponse = await mockApi.fetch(
      `https://mock.substack.com/api/v1/posts/${published.id}`,
      { method: 'DELETE' }
    );
    const body = await deleteResponse.json();

    expect(deleteResponse.ok).toBe(true);
    expect(body.status).toBe('draft');
    expect(body.canonical_url).toBeNull();
  });

  it('fetches an article by ID (GET)', async () => {
    const { body: created } = await postArticle(MOCK_ARTICLES.opinion, false);

    const getResponse = await mockApi.fetch(
      `https://mock.substack.com/api/v1/posts/${created.id}`,
      { method: 'GET' }
    );
    const body = await getResponse.json();

    expect(getResponse.ok).toBe(true);
    expect(body.title).toBe(MOCK_ARTICLES.opinion.title);
    expect(body.status).toBe('published');
  });

  it('returns 404 when deleting non-existent article', async () => {
    const response = await mockApi.fetch(
      'https://mock.substack.com/api/v1/posts/99999',
      { method: 'DELETE' }
    );
    expect(response.status).toBe(404);
  });

  it('returns 404 for unknown routes', async () => {
    const response = await mockApi.fetch(
      'https://mock.substack.com/api/v1/unknown',
      { method: 'GET' }
    );
    expect(response.status).toBe(404);
  });
});

describe('Mock Substack API — request tracking', () => {
  it('records every request for assertion', async () => {
    await postArticle(MOCK_ARTICLES.breakingNews);
    await postArticle(MOCK_ARTICLES.analysis);

    expect(mockApi.requests).toHaveLength(2);
    expect(mockApi.requests[0].method).toBe('POST');
    expect(mockApi.requests[0].path).toBe('/api/v1/posts');
  });

  it('assertCalledWith finds matching request', async () => {
    await postArticle(MOCK_ARTICLES.opinion);

    const match = mockApi.assertCalledWith({
      method: 'POST',
      path: '/posts',
      bodyContains: { title: MOCK_ARTICLES.opinion.title },
    });
    expect(match).toBeDefined();
    expect(match.body.title).toBe(MOCK_ARTICLES.opinion.title);
  });

  it('assertCalledWith throws when no match found', () => {
    expect(() => {
      mockApi.assertCalledWith({ method: 'DELETE', path: '/posts/1' });
    }).toThrow('not found');
  });

  it('findRequests filters by method', async () => {
    await postArticle(MOCK_ARTICLES.minimal);
    const { body } = await postArticle(MOCK_ARTICLES.breakingNews);
    await mockApi.fetch(
      `https://mock.substack.com/api/v1/posts/${body.id}`,
      { method: 'GET' }
    );

    const posts = mockApi.findRequests({ method: 'POST' });
    const gets = mockApi.findRequests({ method: 'GET' });
    expect(posts).toHaveLength(2);
    expect(gets).toHaveLength(1);
  });

  it('lastRequest returns the most recent call', async () => {
    await postArticle(MOCK_ARTICLES.breakingNews);
    await postArticle(MOCK_ARTICLES.analysis);

    expect(mockApi.lastRequest.body.title).toBe(MOCK_ARTICLES.analysis.title);
  });

  it('reset clears all state', async () => {
    await postArticle(MOCK_ARTICLES.breakingNews);
    expect(mockApi.requests).toHaveLength(1);

    mockApi.reset();
    expect(mockApi.requests).toHaveLength(0);
    expect(mockApi.articles.size).toBe(0);
  });
});

describe('Mock Substack API — error simulation', () => {
  it('simulates 500 server error', async () => {
    mockApi.nextError = { status: 500, body: { error: 'Internal failure' } };

    const { response, body } = await postArticle(MOCK_ARTICLES.breakingNews);
    expect(response.status).toBe(500);
    expect(body.error).toBe('Internal failure');
  });

  it('simulates 429 rate limit', async () => {
    mockApi.simulateRateLimit = true;

    const { response, body } = await postArticle(MOCK_ARTICLES.breakingNews);
    expect(response.status).toBe(429);
    expect(body.error).toContain('Rate limit');
  });

  it('simulates request timeout (never-resolving promise)', async () => {
    mockApi.simulateTimeout = true;

    // The mock returns a never-resolving promise; verify it doesn't resolve within 50ms
    const result = await Promise.race([
      mockApi.fetch('https://mock.substack.com/api/v1/posts', {
        method: 'POST',
        body: JSON.stringify({ title: 'T', body_markdown: 'B', draft: true }),
      }),
      new Promise((resolve) => setTimeout(() => resolve('TIMED_OUT'), 50)),
    ]);

    expect(result).toBe('TIMED_OUT');
  });

  it('error flags are consumed after one use', async () => {
    mockApi.nextError = { status: 500, body: { error: 'one-shot' } };

    // First call fails
    const { response: r1 } = await postArticle(MOCK_ARTICLES.breakingNews);
    expect(r1.status).toBe(500);

    // Second call succeeds (error was consumed)
    const { response: r2, body: b2 } = await postArticle(MOCK_ARTICLES.breakingNews);
    expect(r2.status).toBe(201);
    expect(b2.status).toBe('draft');
  });
});

// ══════════════════════════════════════════════════════════════════
// Section 2 — Article Fixtures Validation
// ══════════════════════════════════════════════════════════════════

describe('Article fixtures — structure and cost metadata', () => {
  it('all articles have required fields', () => {
    for (const article of allArticles()) {
      expect(article.id).toBeDefined();
      expect(article.title).toBeTruthy();
      expect(article.body).toBeTruthy();
      expect(article.contentType).toMatch(/^(news|analysis|opinion)$/);
      expect(article.significance).toBeGreaterThanOrEqual(0);
      expect(article.significance).toBeLessThanOrEqual(10);
    }
  });

  it('all articles have valid token usage', () => {
    for (const article of allArticles()) {
      const { draft, review } = article.tokenUsage;
      expect(draft.model).toBe('haiku');
      expect(review.model).toBe('opus');
      expect(draft.inputTokens).toBeGreaterThan(0);
      expect(draft.outputTokens).toBeGreaterThan(0);
      expect(review.inputTokens).toBeGreaterThan(0);
      expect(review.outputTokens).toBeGreaterThan(0);
    }
  });

  it('cost calculation produces positive values', () => {
    for (const article of allArticles()) {
      expect(article.costCents).toBeGreaterThan(0);
    }
  });

  it('estimateCost matches manual calculation', () => {
    // haiku: 1000 in / 1000 out → (1 × 0.00025) + (1 × 0.00125) = 0.0015
    const cost = estimateCost('haiku', 1000, 1000);
    expect(cost).toBeCloseTo(0.0015, 6);
  });

  it('totalCostCents aggregates across articles', () => {
    const total = totalCostCents();
    expect(total).toBeGreaterThan(0);
    // Sanity: 4 articles × average ~5 cents ≈ ~20 cents total
    expect(total).toBeLessThan(1000);
  });

  it('toPublishPayload produces SubstackClient-compatible shape', () => {
    const payload = toPublishPayload(MOCK_ARTICLES.breakingNews, 'publish_mode');
    expect(payload).toEqual({
      title: MOCK_ARTICLES.breakingNews.title,
      body: MOCK_ARTICLES.breakingNews.body,
      subtitle: MOCK_ARTICLES.breakingNews.subtitle,
      mode: 'publish_mode',
    });
  });

  it('TOKEN_COSTS has haiku and opus rates', () => {
    expect(TOKEN_COSTS.haiku).toBeDefined();
    expect(TOKEN_COSTS.opus).toBeDefined();
    expect(TOKEN_COSTS.opus.perThousandOutput).toBeGreaterThan(TOKEN_COSTS.haiku.perThousandOutput);
  });
});

// ══════════════════════════════════════════════════════════════════
// Section 3 — E2E Flow Placeholders (pending until B1 + F1 land)
// ══════════════════════════════════════════════════════════════════

describe('E2E: Approve → Publish → Dashboard Update', () => {
  // These tests require the full dashboard + backend wiring (SubstackClient from B1, UI from F1).
  // Marked as pending (test.todo) until B1 and F1 are delivered.

  it.todo(
    'draft publish: approve article → API creates draft → draftUrl returned → dashboard shows "Draft" badge'
  );

  it.todo(
    'live publish: approve article → API publishes live → publishedUrl returned → dashboard shows "Published" badge with link'
  );

  it.todo(
    'publish failure: API returns 5xx → dashboard shows error toast → retry button appears → retry succeeds'
  );

  it.todo(
    'unpublish: click unpublish on published article → API DELETE called → article reverts to draft → dashboard updated'
  );

  it.todo(
    'rate limit: API returns 429 → dashboard shows "Rate limited" warning → auto-retry after backoff'
  );

  it.todo(
    'cost tracking: after publish, dashboard updates cumulative cost display with article token cost'
  );
});

// ══════════════════════════════════════════════════════════════════
// Section 4 — Integration Smoke (mock API round-trip, no SubstackClient needed)
// ══════════════════════════════════════════════════════════════════

describe('Integration: full publish lifecycle via mock API', () => {
  it('publishes all fixture articles as drafts', async () => {
    for (const article of allArticles()) {
      const { response, body } = await postArticle(article, true);
      expect(response.status).toBe(201);
      expect(body.status).toBe('draft');
    }
    expect(mockApi.requests).toHaveLength(allArticles().length);
  });

  it('publishes then unpublishes an article', async () => {
    const { body: published } = await postArticle(MOCK_ARTICLES.analysis, false);
    expect(published.status).toBe('published');
    expect(published.canonical_url).toBeTruthy();

    // Unpublish
    const deleteRes = await mockApi.fetch(
      `https://mock.substack.com/api/v1/posts/${published.id}`,
      { method: 'DELETE' }
    );
    const body = await deleteRes.json();
    expect(body.status).toBe('draft');
    expect(body.canonical_url).toBeNull();
  });

  it('mock API tracks the full publish → get → unpublish sequence', async () => {
    // 1. Publish
    const { body: created } = await postArticle(MOCK_ARTICLES.breakingNews, false);

    // 2. Read
    await mockApi.fetch(
      `https://mock.substack.com/api/v1/posts/${created.id}`,
      { method: 'GET' }
    );

    // 3. Unpublish
    await mockApi.fetch(
      `https://mock.substack.com/api/v1/posts/${created.id}`,
      { method: 'DELETE' }
    );

    // Verify request log
    expect(mockApi.requests).toHaveLength(3);
    expect(mockApi.requests.map((r) => r.method)).toEqual(['POST', 'GET', 'DELETE']);
  });

  it('handles mixed success and failure scenarios', async () => {
    // First publish succeeds
    const { response: r1 } = await postArticle(MOCK_ARTICLES.breakingNews, false);
    expect(r1.status).toBe(201);

    // Second publish hits 500
    mockApi.nextError = { status: 500, body: { error: 'db down' } };
    const { response: r2 } = await postArticle(MOCK_ARTICLES.analysis, false);
    expect(r2.status).toBe(500);

    // Third publish succeeds (error consumed)
    const { response: r3 } = await postArticle(MOCK_ARTICLES.opinion, false);
    expect(r3.status).toBe(201);

    // Verify 3 requests recorded
    expect(mockApi.requests).toHaveLength(3);
  });
});
