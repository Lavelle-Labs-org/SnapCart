import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/navigation
const mockNotFound = vi.fn();
vi.mock("next/navigation", () => ({
  notFound: () => {
    mockNotFound();
    throw new Error("NEXT_NOT_FOUND");
  },
}));

// Mock prisma
const mockFindUniqueSeller = vi.fn();
const mockFindUniqueVerification = vi.fn();

vi.mock("../../../../../../lib/prisma", () => ({
  prisma: {
    seller: {
      findUnique: (...args: any[]) => mockFindUniqueSeller(...args),
    },
    phoneVerification: {
      findUnique: (...args: any[]) => mockFindUniqueVerification(...args),
    },
  },
}));

import VerifyPage from "../page";

describe("VerifyPage (FE-003)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls notFound when seller is not found in database", async () => {
    mockFindUniqueSeller.mockResolvedValue(null);

    await expect(
      VerifyPage({
        params: Promise.resolve({ slug: "unknown-shop", draftId: "draft-1" }),
      })
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mockNotFound).toHaveBeenCalled();
  });

  it("calls notFound when verification draft is not found", async () => {
    mockFindUniqueSeller.mockResolvedValue({
      id: "seller-1",
      business_name: "Habesha Cafe",
      sms_name: "Habesha",
      slug: "habesha",
    });
    mockFindUniqueVerification.mockResolvedValue(null);

    await expect(
      VerifyPage({
        params: Promise.resolve({ slug: "habesha", draftId: "nonexistent-draft" }),
      })
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mockNotFound).toHaveBeenCalled();
  });

  it("renders VerifyOtpForm when seller and draft exist", async () => {
    mockFindUniqueSeller.mockResolvedValue({
      id: "seller-1",
      business_name: "Habesha Cafe",
      sms_name: "Habesha",
      slug: "habesha",
    });

    const now = new Date();
    mockFindUniqueVerification.mockResolvedValue({
      id: "draft-1",
      phone: "0911223344",
      purpose: "buyer_checkout",
      status: "pending",
      last_sent_at: now,
      expires_at: new Date(now.getTime() + 300000),
    });

    const result = await VerifyPage({
      params: Promise.resolve({ slug: "habesha", draftId: "draft-1" }),
    });

    expect(result).toBeDefined();
    expect(result.props.slug).toBe("habesha");
    expect(result.props.draftId).toBe("draft-1");
    expect(result.props.phone).toBe("0911223344");
  });
});
