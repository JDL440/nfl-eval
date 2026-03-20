import { describe, it, expect, vi } from 'vitest';
import { EventBus, sseHandler, formatSSE, registerSSE } from '../../src/dashboard/sse.js';
import type { PipelineEvent } from '../../src/dashboard/sse.js';
import { Hono } from 'hono';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEvent(overrides?: Partial<PipelineEvent>): PipelineEvent {
  return {
    type: 'stage_changed',
    articleId: 'test-article',
    data: { from: 1, to: 2 },
    timestamp: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

// ── EventBus ─────────────────────────────────────────────────────────────────

describe('EventBus', () => {
  it('delivers events to a subscriber', () => {
    const bus = new EventBus();
    const received: PipelineEvent[] = [];
    bus.subscribe((e) => received.push(e));

    const event = makeEvent();
    bus.emit(event);

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(event);
  });

  it('delivers events to multiple subscribers', () => {
    const bus = new EventBus();
    const a: PipelineEvent[] = [];
    const b: PipelineEvent[] = [];
    bus.subscribe((e) => a.push(e));
    bus.subscribe((e) => b.push(e));

    bus.emit(makeEvent());

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  it('unsubscribe removes the listener', () => {
    const bus = new EventBus();
    const received: PipelineEvent[] = [];
    const unsub = bus.subscribe((e) => received.push(e));

    bus.emit(makeEvent());
    expect(received).toHaveLength(1);

    unsub();
    bus.emit(makeEvent({ type: 'article_created' }));
    expect(received).toHaveLength(1); // no new events
  });

  it('subscriberCount tracks active connections', () => {
    const bus = new EventBus();
    expect(bus.subscriberCount).toBe(0);

    const unsub1 = bus.subscribe(() => {});
    expect(bus.subscriberCount).toBe(1);

    const unsub2 = bus.subscribe(() => {});
    expect(bus.subscriberCount).toBe(2);

    unsub1();
    expect(bus.subscriberCount).toBe(1);

    unsub2();
    expect(bus.subscriberCount).toBe(0);
  });

  it('emitting with no subscribers does not throw', () => {
    const bus = new EventBus();
    expect(() => bus.emit(makeEvent())).not.toThrow();
  });

  it('double-unsubscribe is safe', () => {
    const bus = new EventBus();
    const unsub = bus.subscribe(() => {});
    unsub();
    expect(() => unsub()).not.toThrow();
    expect(bus.subscriberCount).toBe(0);
  });
});

// ── formatSSE ────────────────────────────────────────────────────────────────

describe('formatSSE', () => {
  it('produces spec-compliant SSE message', () => {
    const event = makeEvent();
    const message = formatSSE(event);

    expect(message).toContain('event: stage_changed\n');
    expect(message).toContain('data: ');
    expect(message.endsWith('\n\n')).toBe(true);

    // data line should be valid JSON matching the event
    const dataLine = message.split('\n').find((l) => l.startsWith('data: '))!;
    const parsed = JSON.parse(dataLine.slice('data: '.length));
    expect(parsed.type).toBe('stage_changed');
    expect(parsed.articleId).toBe('test-article');
  });

  it('formats different event types', () => {
    const event = makeEvent({ type: 'batch_completed', data: { count: 5 } });
    const message = formatSSE(event);
    expect(message).toContain('event: batch_completed\n');
  });
});

// ── SSE handler ──────────────────────────────────────────────────────────────

describe('sseHandler', () => {
  it('returns response with correct SSE headers', async () => {
    const bus = new EventBus();
    const app = new Hono();
    app.get('/events', sseHandler(bus));

    const res = await app.request('/events');

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.headers.get('Cache-Control')).toBe('no-cache');
    expect(res.headers.get('Connection')).toBe('keep-alive');
  });

  it('streams emitted events to the response body', async () => {
    const bus = new EventBus();
    const app = new Hono();
    app.get('/events', sseHandler(bus));

    const res = await app.request('/events');
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    // Emit an event after the stream is connected
    const event = makeEvent();
    bus.emit(event);

    const { value } = await reader.read();
    const chunk = decoder.decode(value);

    expect(chunk).toContain('event: stage_changed');
    expect(chunk).toContain('"articleId":"test-article"');
    expect(chunk.endsWith('\n\n')).toBe(true);

    reader.cancel();
  });

  it('subscribes on connect and unsubscribes on abort', async () => {
    const bus = new EventBus();
    const app = new Hono();
    app.get('/events', sseHandler(bus));

    const controller = new AbortController();
    const req = new Request('http://localhost/events', { signal: controller.signal });
    const res = await app.request(req);

    // The handler should have subscribed
    expect(bus.subscriberCount).toBe(1);

    // Abort simulates client disconnect
    controller.abort();

    // Give the microtask queue a tick to process the abort listener
    await new Promise((r) => setTimeout(r, 10));

    expect(bus.subscriberCount).toBe(0);

    // Suppress body-not-consumed warning
    try { await res.text(); } catch { /* aborted */ }
  });

  it('handles multiple concurrent SSE connections', async () => {
    const bus = new EventBus();
    const app = new Hono();
    app.get('/events', sseHandler(bus));

    const res1 = await app.request('/events');
    const res2 = await app.request('/events');

    expect(bus.subscriberCount).toBe(2);

    const reader1 = res1.body!.getReader();
    const reader2 = res2.body!.getReader();

    bus.emit(makeEvent({ type: 'article_published' }));

    const decoder = new TextDecoder();
    const [chunk1, chunk2] = await Promise.all([
      reader1.read().then((r) => decoder.decode(r.value)),
      reader2.read().then((r) => decoder.decode(r.value)),
    ]);

    expect(chunk1).toContain('event: article_published');
    expect(chunk2).toContain('event: article_published');

    reader1.cancel();
    reader2.cancel();
  });
});

// ── registerSSE ──────────────────────────────────────────────────────────────

describe('registerSSE', () => {
  it('registers /events route on the app', async () => {
    const bus = new EventBus();
    const app = new Hono();
    registerSSE(app, bus);

    const res = await app.request('/events');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
  });
});
