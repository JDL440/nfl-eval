/**
 * sse.ts — Server-Sent Events support for real-time dashboard updates.
 *
 * EventBus is a simple in-memory pub/sub. Pipeline engine and scheduler
 * call bus.emit() when state changes; connected browsers receive updates
 * via the /events SSE stream (consumed by htmx sse-connect).
 */

import type { Context } from 'hono';
import type { Hono } from 'hono';

// ── Event types ──────────────────────────────────────────────────────────────

export interface PipelineEvent {
  type:
    | 'stage_changed'
    | 'stage_working'
    | 'stage_error'
    | 'pipeline_complete'
    | 'article_created'
    | 'article_published'
    | 'batch_started'
    | 'batch_completed';
  articleId?: string;
  data: Record<string, unknown>;
  timestamp: string;
}

// ── EventBus ─────────────────────────────────────────────────────────────────

type Listener = (event: PipelineEvent) => void;

export class EventBus {
  private listeners = new Set<Listener>();

  /** Subscribe to events. Returns a cleanup function that removes the listener. */
  subscribe(callback: Listener): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /** Emit an event to all current subscribers. */
  emit(event: PipelineEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  /** Number of active subscribers. */
  get subscriberCount(): number {
    return this.listeners.size;
  }
}

// ── SSE helpers ──────────────────────────────────────────────────────────────

/** Format a PipelineEvent as an SSE message (spec-compliant). */
export function formatSSE(event: PipelineEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

/** Create a Hono handler that streams SSE to the client. */
export function sseHandler(bus: EventBus): (c: Context) => Response {
  return (c: Context): Response => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();

        const unsubscribe = bus.subscribe((event) => {
          try {
            controller.enqueue(encoder.encode(formatSSE(event)));
          } catch {
            // Stream closed by client — clean up silently.
            unsubscribe();
          }
        });

        // Heartbeat every 30s to keep connection alive through proxies/NAT
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': heartbeat\n\n'));
          } catch {
            clearInterval(heartbeat);
            unsubscribe();
          }
        }, 30_000);

        // If the client disconnects, the request signal fires abort.
        c.req.raw.signal.addEventListener('abort', () => {
          clearInterval(heartbeat);
          unsubscribe();
          try {
            controller.close();
          } catch {
            // Already closed.
          }
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  };
}

/** Register the /events SSE route on a Hono app. */
export function registerSSE(app: Hono, bus: EventBus): void {
  app.get('/events', sseHandler(bus));
}
