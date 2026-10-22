import { describe, it, expect } from "vitest";
import nextConfig from "../next.config.mjs";

describe("Next.js Proxy Rewrites (PR-004, Issue #123)", () => {
  it("proxies /api/:path* to the internal API server", async () => {
    expect(typeof nextConfig.rewrites).toBe("function");
    if (!nextConfig.rewrites) {
      throw new Error("nextConfig.rewrites is undefined");
    }
    const rewritesResult = await nextConfig.rewrites();
    expect(Array.isArray(rewritesResult)).toBe(true);
    const rewrites = rewritesResult as Array<{ source: string; destination: string }>;

    const apiRewrite = rewrites.find((r) => r.source === "/api/:path*");
    expect(apiRewrite).toBeDefined();
    expect(apiRewrite?.destination).toContain("/api/:path*");
  });

  it("proxies /webhooks/:path* transparently to the internal API server per SMSHub spec", async () => {
    if (!nextConfig.rewrites) {
      throw new Error("nextConfig.rewrites is undefined");
    }
    const rewritesResult = await nextConfig.rewrites();
    const rewrites = rewritesResult as Array<{ source: string; destination: string }>;

    const webhookRewrite = rewrites.find((r) => r.source === "/webhooks/:path*");
    expect(webhookRewrite).toBeDefined();
    expect(webhookRewrite?.destination).toBe(
      `${process.env.INTERNAL_API_URL || "http://localhost:4000"}/webhooks/:path*`
    );
  });
});
