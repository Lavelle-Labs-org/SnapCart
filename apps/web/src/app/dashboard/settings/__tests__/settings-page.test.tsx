import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => {
  return {
    prismaMock: {
      seller: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
    },
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

vi.mock("../../../../../lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

vi.mock("../../../../lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

vi.mock("../../../lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  redirect: redirectMock,
}));

import SettingsPage from "../page";
import SettingsClient from "../settings-client";

describe("SettingsPage Server Component (FE-013, Issue #36)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads seller profile from database by sellerId and passes initial values to SettingsClient", async () => {
    const mockSeller = {
      id: "seller-123",
      business_name: "Habesha Gourmet Bakery",
      sms_name: "Habesha Bakery",
      slug: "habesha-gourmet",
      phone: "+251911223344",
      created_at: new Date(),
    };
    prismaMock.seller.findUnique.mockResolvedValue(mockSeller);

    const element = await SettingsPage({
      searchParams: Promise.resolve({ sellerId: "seller-123" }),
    });

    expect(element).toBeDefined();
    expect(element.type).toBe(SettingsClient);

    const props = element.props;
    expect(props.initialSeller).toEqual({
      id: "seller-123",
      businessName: "Habesha Gourmet Bakery",
      smsName: "Habesha Bakery",
      slug: "habesha-gourmet",
      phone: "+251911223344",
    });
  });

  it("redirects unauthenticated users to /login instead of falling back to hardcoded demo cafe", async () => {
    prismaMock.seller.findUnique.mockResolvedValue(null);

    await SettingsPage({});

    expect(redirectMock).toHaveBeenCalledWith("/login");
  });
});
