import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type LimitRule = "createTape" | "createTapeIp" | "replyTape" | "pickHourly" | "pickBurst";

const RULE_CONFIG: Record<
  LimitRule,
  { limit: number; windowMs: number; windowStr: `${number} ${"s" | "m" | "h" | "d"}` }
> = {
  createTape: { limit: 3, windowMs: 24 * 60 * 60 * 1000, windowStr: "24 h" },
  createTapeIp: { limit: 10, windowMs: 24 * 60 * 60 * 1000, windowStr: "24 h" },
  replyTape: { limit: 5, windowMs: 24 * 60 * 60 * 1000, windowStr: "24 h" },
  pickHourly: { limit: 15, windowMs: 60 * 60 * 1000, windowStr: "1 h" },
  pickBurst: { limit: 5, windowMs: 10 * 60 * 1000, windowStr: "10 m" },
};

// In-memory sliding-window fallback for local dev without Upstash env vars
const memoryStore = new Map<string, number[]>();
const upstashLimiters = new Map<LimitRule, Ratelimit>();

function getUpstashLimiter(rule: LimitRule): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const cached = upstashLimiters.get(rule);
  if (cached) return cached;

  const cfg = RULE_CONFIG[rule];
  const limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(cfg.limit, cfg.windowStr),
    prefix: `mt:rl:${rule}`,
  });

  upstashLimiters.set(rule, limiter);
  return limiter;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export async function checkRateLimit(
  rule: LimitRule,
  identifier: string
): Promise<RateLimitResult> {
  const upstash = getUpstashLimiter(rule);
  if (upstash) {
    const res = await upstash.limit(identifier);
    return {
      allowed: res.success,
      remaining: res.remaining,
      retryAfterSeconds: Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)),
    };
  }

  // Fallback in-memory sliding window
  const cfg = RULE_CONFIG[rule];
  const key = `${rule}:${identifier}`;
  const now = Date.now();
  const windowStart = now - cfg.windowMs;

  const timestamps = (memoryStore.get(key) || []).filter((t) => t > windowStart);
  if (timestamps.length >= cfg.limit) {
    const oldest = timestamps[0] ?? now;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + cfg.windowMs - now) / 1000)
    );
    memoryStore.set(key, timestamps);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  timestamps.push(now);
  memoryStore.set(key, timestamps);
  return {
    allowed: true,
    remaining: Math.max(0, cfg.limit - timestamps.length),
    retryAfterSeconds: 0,
  };
}
