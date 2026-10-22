import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * Rate Limiting Utility (BE-017, docs/06 Sec 2, docs/08)
 * Fixed window rate limiter using Prisma `rate_counters` table.
 */

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  count: number;
  resetAt: Date;
}

export interface RateLimitOptions {
  key: string;
  limit: number;
  windowSeconds: number;
}

export class RateLimitedException extends HttpException {
  constructor(message: string, retryAfterSeconds: number) {
    super(
      {
        code: "RATE_LIMITED",
        message,
        retryAfter: retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS
    );
  }
}

export function enforceRateLimit(
  result: RateLimitResult,
  customMessage?: string
): void;
export function enforceRateLimit(
  result: Promise<RateLimitResult>,
  customMessage?: string
): Promise<void>;
export function enforceRateLimit(
  resultOrPromise: RateLimitResult | Promise<RateLimitResult>,
  customMessage?: string
): void | Promise<void> {
  if (
    resultOrPromise instanceof Promise ||
    typeof (resultOrPromise as any)?.then === "function"
  ) {
    return (resultOrPromise as Promise<RateLimitResult>).then((result) => {
      enforceRateLimit(result, customMessage);
    });
  }
  const result = resultOrPromise as RateLimitResult;
  if (!result.allowed) {
    const retryAfter = Math.max(
      1,
      Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)
    );
    const message =
      customMessage ||
      `Rate limit exceeded. Maximum ${result.limit} requests per hour. Please retry after ${retryAfter} seconds.`;
    throw new RateLimitedException(message, retryAfter);
  }
}

export function extractClientIp(req: any): string {
  if (!req) return "127.0.0.1";
  const xForwardedFor = req.headers?.["x-forwarded-for"];
  if (typeof xForwardedFor === "string") {
    const first = xForwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.ip || req.socket?.remoteAddress || "127.0.0.1";
}

/**
 * Checks and increments rate limit counter using Prisma `rate_counters` table.
 * If window has expired or record doesn't exist, resets counter to 1 and starts new window.
 */
export async function consumeRateLimit(
  prisma: any,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const { key, limit, windowSeconds } = options;
  const now = new Date();
  const windowMs = windowSeconds * 1000;

  if (!prisma?.rateCounter) {
    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - 1),
      count: 1,
      resetAt: new Date(now.getTime() + windowMs),
    };
  }

  const existing = await prisma.rateCounter.findUnique({
    where: { key },
  });

  if (!existing || now.getTime() - existing.window_start.getTime() >= windowMs) {
    const resetAt = new Date(now.getTime() + windowMs);
    await prisma.rateCounter.upsert({
      where: { key },
      create: {
        key,
        window_start: now,
        count: 1,
      },
      update: {
        window_start: now,
        count: 1,
      },
    });

    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - 1),
      count: 1,
      resetAt,
    };
  }

  const resetAt = new Date(existing.window_start.getTime() + windowMs);

  if (existing.count >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      count: existing.count,
      resetAt,
    };
  }

  let updatedCount = existing.count + 1;
  if (typeof prisma.rateCounter.update === "function") {
    const updated = await prisma.rateCounter.update({
      where: { key },
      data: { count: { increment: 1 } },
    });
    if (updated?.count !== undefined) {
      updatedCount = updated.count;
    }
  } else if (typeof prisma.rateCounter.upsert === "function") {
    const updated = await prisma.rateCounter.upsert({
      where: { key },
      create: { key, count: 1, expires_at: resetAt },
      update: { count: { increment: 1 } },
    });
    if (updated?.count !== undefined) {
      updatedCount = updated.count;
    }
  }

  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - updatedCount),
    count: updatedCount,
    resetAt,
  };
}

/**
 * Checks a rate limit without incrementing the counter (read-only inspection).
 */
export async function checkRateLimit(
  prisma: any,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const { key, limit, windowSeconds } = options;
  const now = new Date();
  const windowMs = windowSeconds * 1000;

  if (!prisma?.rateCounter) {
    return {
      allowed: true,
      limit,
      remaining: limit,
      count: 0,
      resetAt: new Date(now.getTime() + windowMs),
    };
  }

  const existing = await prisma.rateCounter.findUnique({
    where: { key },
  });

  if (!existing || now.getTime() - existing.window_start.getTime() >= windowMs) {
    return {
      allowed: true,
      limit,
      remaining: limit,
      count: 0,
      resetAt: new Date(now.getTime() + windowMs),
    };
  }

  const resetAt = new Date(existing.window_start.getTime() + windowMs);
  const remaining = Math.max(0, limit - existing.count);

  return {
    allowed: existing.count < limit,
    limit,
    remaining,
    count: existing.count,
    resetAt,
  };
}

/**
 * Checks phone verification/dispatch rate limit per phone number (default: 5 per hour).
 * docs/06 Section 2: Max 5 per phone/hr
 */
export async function checkPhoneRateLimit(
  prisma: any,
  phone: string,
  limit: number = 5,
  windowSeconds: number = 3600
): Promise<RateLimitResult> {
  const key = `rate:phone:${phone}`;
  return consumeRateLimit(prisma, { key, limit, windowSeconds });
}

/**
 * Checks IP rate limit (default: 10 per hour).
 * docs/06 Section 2: Max 10 per IP/hr
 */
export async function checkIpRateLimit(
  prisma: any,
  ip: string,
  limit: number = 10,
  windowSeconds: number = 3600
): Promise<RateLimitResult> {
  const key = `rate:ip:${ip}`;
  return consumeRateLimit(prisma, { key, limit, windowSeconds });
}
