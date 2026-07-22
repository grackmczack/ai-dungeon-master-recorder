import type { FastifyReply, FastifyRequest } from "fastify";

type RateLimitEntry = { count: number; resetAt: number };

export type RateLimitResult =
  | { allowed: true; remaining: number; resetAt: number }
  | { allowed: false; retryAfterSeconds: number; resetAt: number };

export class FixedWindowRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();
  private requestsSinceCleanup = 0;

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number
  ) {}

  consume(key: string, now = Date.now()): RateLimitResult {
    this.requestsSinceCleanup += 1;
    if (this.requestsSinceCleanup >= 500) {
      this.cleanup(now);
      this.requestsSinceCleanup = 0;
    }

    const current = this.entries.get(key);
    const entry =
      !current || current.resetAt <= now ? { count: 0, resetAt: now + this.windowMs } : current;

    entry.count += 1;
    this.entries.set(key, entry);

    if (entry.count > this.maxRequests) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
        resetAt: entry.resetAt
      };
    }

    return {
      allowed: true,
      remaining: this.maxRequests - entry.count,
      resetAt: entry.resetAt
    };
  }

  clear(): void {
    this.entries.clear();
  }

  private cleanup(now: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) this.entries.delete(key);
    }
  }
}

export function rateLimit(
  limiter: FixedWindowRateLimiter,
  key: (request: FastifyRequest) => string
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const result = limiter.consume(key(request));
    if (result.allowed) return;

    reply.header("Retry-After", String(result.retryAfterSeconds));
    return reply.status(429).send({
      error: "Zu viele Versuche. Bitte warte kurz und versuche es erneut.",
      retryAfterSeconds: result.retryAfterSeconds
    });
  };
}

export function normalizedEmailFromBody(request: FastifyRequest): string {
  const email = (request.body as { email?: unknown } | null)?.email;
  return typeof email === "string" ? email.trim().toLowerCase() : "unknown";
}
