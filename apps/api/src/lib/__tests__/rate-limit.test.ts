import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  consumeRateLimit,
  checkRateLimit,
  checkPhoneRateLimit,
  checkIpRateLimit,
} from "../rate-limit";

describe("Rate Limiting Utility (BE-017, docs/06 Sec 2)", () => {
  let prismaMock: any;
  const store = new Map<string, any>();

  beforeEach(() => {
    store.clear();
    prismaMock = {
      rateCounter: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          return Promise.resolve(store.get(where.key) ?? null);
        }),
        upsert: vi.fn().mockImplementation(({ where, create, update }) => {
          const existing = store.get(where.key);
          const record = existing
            ? { ...existing, ...update }
            : { key: where.key, ...create };
          store.set(where.key, record);
          return Promise.resolve(record);
        }),
        update: vi.fn().mockImplementation(({ where, data }) => {
          const existing = store.get(where.key);
          const newCount =
            data.count && data.count.increment !== undefined
              ? (existing?.count ?? 0) + data.count.increment
              : (data.count ?? 1);
          const record = { ...existing, count: newCount };
          store.set(where.key, record);
          return Promise.resolve(record);
        }),
      },
    };
  });

  describe("consumeRateLimit", () => {
    it("creates a new rate counter and allows request when no record exists", async () => {
      const res = await consumeRateLimit(prismaMock, {
        key: "test_key",
        limit: 5,
        windowSeconds: 60,
      });

      expect(res.allowed).toBe(true);
      expect(res.count).toBe(1);
      expect(res.remaining).toBe(4);
      expect(prismaMock.rateCounter.upsert).toHaveBeenCalled();
    });

    it("increments counter on subsequent requests within window", async () => {
      store.set("test_key", {
        key: "test_key",
        window_start: new Date(),
        count: 1,
      });

      const res = await consumeRateLimit(prismaMock, {
        key: "test_key",
        limit: 5,
        windowSeconds: 60,
      });

      expect(res.allowed).toBe(true);
      expect(res.count).toBe(2);
      expect(res.remaining).toBe(3);
      expect(prismaMock.rateCounter.update).toHaveBeenCalled();
    });

    it("rejects request when count reaches limit", async () => {
      store.set("test_key", {
        key: "test_key",
        window_start: new Date(),
        count: 5,
      });

      const res = await consumeRateLimit(prismaMock, {
        key: "test_key",
        limit: 5,
        windowSeconds: 60,
      });

      expect(res.allowed).toBe(false);
      expect(res.count).toBe(5);
      expect(res.remaining).toBe(0);
      expect(prismaMock.rateCounter.update).not.toHaveBeenCalled();
    });

    it("resets counter when window has expired", async () => {
      store.set("test_key", {
        key: "test_key",
        window_start: new Date(Date.now() - 70000), // 70s ago for 60s window
        count: 5,
      });

      const res = await consumeRateLimit(prismaMock, {
        key: "test_key",
        limit: 5,
        windowSeconds: 60,
      });

      expect(res.allowed).toBe(true);
      expect(res.count).toBe(1);
      expect(res.remaining).toBe(4);
      expect(prismaMock.rateCounter.upsert).toHaveBeenCalled();
    });
  });

  describe("checkRateLimit (Read-Only)", () => {
    it("returns allowed with full remaining when no record exists without mutating", async () => {
      const res = await checkRateLimit(prismaMock, {
        key: "read_key",
        limit: 5,
        windowSeconds: 60,
      });

      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(5);
      expect(res.count).toBe(0);
      expect(prismaMock.rateCounter.upsert).not.toHaveBeenCalled();
      expect(prismaMock.rateCounter.update).not.toHaveBeenCalled();
    });

    it("returns disallowed when counter reached limit", async () => {
      store.set("read_key", {
        key: "read_key",
        window_start: new Date(),
        count: 5,
      });

      const res = await checkRateLimit(prismaMock, {
        key: "read_key",
        limit: 5,
        windowSeconds: 60,
      });

      expect(res.allowed).toBe(false);
      expect(res.remaining).toBe(0);
      expect(res.count).toBe(5);
    });
  });

  describe("checkPhoneRateLimit & checkIpRateLimit", () => {
    it("enforces phone rate limit key format and default limit", async () => {
      const res = await checkPhoneRateLimit(prismaMock, "0911223344", 5, 3600);
      expect(res.allowed).toBe(true);
      expect(store.has("rate:phone:0911223344")).toBe(true);
    });

    it("enforces IP rate limit key format and default limit", async () => {
      const res = await checkIpRateLimit(prismaMock, "192.168.1.1", 10, 3600);
      expect(res.allowed).toBe(true);
      expect(store.has("rate:ip:192.168.1.1")).toBe(true);
    });
  });
});
