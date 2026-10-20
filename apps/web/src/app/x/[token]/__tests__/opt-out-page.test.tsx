import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindUniqueActionToken = vi.fn();
const mockFindUniqueSuppression = vi.fn();

vi.mock("../../../../lib/prisma", () => ({
  prisma: {
    actionToken: {
      findUnique: (...args: any[]) => mockFindUniqueActionToken(...args),
    },
    suppressionList: {
      findUnique: (...args: any[]) => mockFindUniqueSuppression(...args),
    },
  },
}));

import StopTextsPage from "../page";

describe("StopTextsPage Server Component (FE-006 - /x/[token])", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads preview metadata from actionToken and suppressionList without side effects", async () => {
    mockFindUniqueActionToken.mockResolvedValue({
      id: "tok-uuid-1",
      purpose: "buyer_stop",
      order: {
        id: "ord-1",
        number: 1043,
        buyer_phone: "+251911223344",
        seller: {
          sms_name: "Habesha Cafe",
          business_name: "Habesha Cafe & Bakery",
        },
      },
    });
    mockFindUniqueSuppression.mockResolvedValue(null);

    const element = await StopTextsPage({
      params: Promise.resolve({ token: "tok_raw_test_123" }),
    });

    expect(element).toBeDefined();
    expect(element.props.token).toBe("tok_raw_test_123");
    expect(element.props.initialData).toEqual({
      orderNumber: 1043,
      shopName: "Habesha Cafe",
      alreadySuppressed: false,
    });
  });

  it("handles unknown or missing token gracefully without crashing", async () => {
    mockFindUniqueActionToken.mockResolvedValue(null);

    const element = await StopTextsPage({
      params: Promise.resolve({ token: "tok_unknown" }),
    });

    expect(element).toBeDefined();
    expect(element.props.token).toBe("tok_unknown");
    expect(element.props.initialData).toBeNull();
  });
});
