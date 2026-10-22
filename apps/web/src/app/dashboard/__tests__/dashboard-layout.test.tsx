import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/order_by_sms";

const { prismaMock } = vi.hoisted(() => {
  return {
    prismaMock: {
      seller: {
        findUnique: vi.fn(),
      },
    },
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

vi.mock("../../lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

vi.mock("../../../lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({
      value: "eyJhbGciOiJIUzI1NiJ9.eyJzZWxsZXJJZCI6InNlbGxlci0xMjMifQ.signature",
    }),
  }),
}));

import DashboardLayout from "../layout";

function findElements(node: any, predicate: (n: any) => boolean): any[] {
  const results: any[] = [];
  function traverse(current: any) {
    if (!current) return;
    if (predicate(current)) results.push(current);
    if (Array.isArray(current)) {
      current.forEach(traverse);
    } else if (current.props?.children) {
      traverse(current.props.children);
    }
  }
  traverse(node);
  return results;
}

describe("DashboardLayout Component (PR-009, Issue #128)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders View Storefront link pointing to /s/{slug} instead of broken /c/{slug}", async () => {
    prismaMock.seller.findUnique.mockResolvedValue({
      id: "seller-123",
      business_name: "Habesha Coffee",
      slug: "habesha-coffee",
    });

    const jsx = await DashboardLayout({ children: <div>Child Content</div> });
    expect(jsx).toBeDefined();

    const links = findElements(jsx, (n) => n.type === "a" && n.props?.href?.includes("habesha-coffee"));
    expect(links.length).toBeGreaterThan(0);

    const storefrontLink = links[0];
    // This will fail on the unpatched code because href is '/c/habesha-coffee'
    expect(storefrontLink.props.href).toBe("/s/habesha-coffee");
  });
});
