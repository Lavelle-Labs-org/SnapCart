import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import { BillingClient } from "../billing-client";
import { LanguageProvider } from "../../../../lib/i18n";

function extractText(node: any): string {
  if (!node) return "";
  try {
    const html = renderToString(node);
    return html
      .replace(/&amp;/g, "&")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(extractText).join(" ");
    if (node.props?.children) return extractText(node.props.children);
    return "";
  }
}

describe("BillingClient & History Table Localization", () => {
  const mockBalance = {
    smsCredits: 42,
    smsCreditsUsed: 158,
    currency: "ETB",
    lowBalance: false,
    isOutOfCredits: false,
  };

  const mockTransactions = [
    {
      id: "tx_1",
      sellerId: "seller_1",
      txRef: "TX-STARTER-001",
      packageId: "starter_50",
      amountEtb: 150,
      currency: "ETB",
      creditsAdded: 50,
      paymentMethod: "chapa",
      status: "completed" as const,
      createdAt: "2026-10-25T10:00:00.000Z",
    },
    {
      id: "tx_2",
      sellerId: "seller_1",
      txRef: "TX-GROWTH-002",
      packageId: "growth_200",
      amountEtb: 450,
      currency: "ETB",
      creditsAdded: 200,
      paymentMethod: "telebirr",
      status: "pending" as const,
      createdAt: "2026-10-26T12:00:00.000Z",
    },
    {
      id: "tx_3",
      sellerId: "seller_1",
      txRef: "TX-PRO-003",
      packageId: "pro_500",
      amountEtb: 950,
      currency: "ETB",
      creditsAdded: 500,
      paymentMethod: "cbebirr",
      status: "failed" as const,
      createdAt: "2026-10-27T14:00:00.000Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/billing/balance")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: mockBalance }),
        });
      }
      if (url.includes("/api/billing/transactions")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: mockTransactions }),
        });
      }
      return Promise.reject(new Error(`Unhandled url: ${url}`));
    });
  });

  it("renders history table in English with translated status badges, package names, and methods", () => {
    const tree = (
      <LanguageProvider initialLocale="en">
        <BillingClient
          initialBalance={mockBalance}
          initialTransactions={mockTransactions}
        />
      </LanguageProvider>
    );

    const text = extractText(tree);

    // Title & headers
    expect(text).toContain("Billing & SMS Credits");
    expect(text).toContain("Payment & Top-Up History");
    expect(text).toContain("Reference");
    expect(text).toContain("Amount");
    expect(text).toContain("Method");
    expect(text).toContain("Status");

    // Gateways
    expect(text).toContain("Telebirr");
    expect(text).toContain("CBE Birr");
    expect(text).toContain("Cards");

    // History Table Rows
    expect(text).toContain("TX-STARTER-001");
    expect(text).toContain("50 SMS");
    expect(text).toContain("Starter Pack");
    expect(text).toContain("150 ETB");
    expect(text).toContain("Chapa");
    expect(text).toContain("Completed");

    expect(text).toContain("TX-GROWTH-002");
    expect(text).toContain("200 SMS");
    expect(text).toContain("Growth Pack");
    expect(text).toContain("450 ETB");
    expect(text).toContain("Telebirr");
    expect(text).toContain("Pending");

    expect(text).toContain("TX-PRO-003");
    expect(text).toContain("500 SMS");
    expect(text).toContain("Pro Pack");
    expect(text).toContain("950 ETB");
    expect(text).toContain("CBE Birr");
    expect(text).toContain("Failed");
  });

  it("renders history table in Amharic reactively with localized status, packages, methods, and currency", () => {
    const tree = (
      <LanguageProvider initialLocale="am">
        <BillingClient
          initialBalance={mockBalance}
          initialTransactions={mockTransactions}
        />
      </LanguageProvider>
    );

    const text = extractText(tree);

    // Amharic title & headers
    expect(text).toContain("ክፍያና የኤስኤምኤስ ክሬዲት");
    expect(text).toContain("የክፍያና የክሬዲት ግዢ ታሪክ");
    expect(text).toContain("መለያ ቁጥር");
    expect(text).toContain("የተከፈለው ብር");
    expect(text).toContain("መንገድ");
    expect(text).toContain("የክፍያ ሁኔታ");

    // Amharic bundles and gateways
    expect(text).toContain("የጀማሪ ፓኬጅ");
    expect(text).toContain("የእድገት ፓኬጅ");
    expect(text).toContain("የድርጅት ፓኬጅ");
    expect(text).toContain("ቴሌብር");
    expect(text).toContain("ሲቢኢ ብር");
    expect(text).toContain("ካርድ");
    expect(text).toContain("ብር");

    // History Table Rows in Amharic
    expect(text).toContain("TX-STARTER-001");
    expect(text).toContain("50 ኤስኤምኤስ");
    expect(text).toContain("የጀማሪ ፓኬጅ");
    expect(text).toContain("150 ብር");
    expect(text).toContain("ቻፓ");
    expect(text).toContain("ተጠናቋል");

    expect(text).toContain("TX-GROWTH-002");
    expect(text).toContain("200 ኤስኤምኤስ");
    expect(text).toContain("የእድገት ፓኬጅ");
    expect(text).toContain("450 ብር");
    expect(text).toContain("ቴሌብር");
    expect(text).toContain("በመጠባበቅ ላይ");

    expect(text).toContain("TX-PRO-003");
    expect(text).toContain("500 ኤስኤምኤስ");
    expect(text).toContain("የድርጅት ፓኬጅ");
    expect(text).toContain("950 ብር");
    expect(text).toContain("ሲቢኢ ብር");
    expect(text).toContain("ያልተሳካ");
  });

  it("renders localized empty transaction state when transactions array is empty", () => {
    const tree = (
      <LanguageProvider initialLocale="am">
        <BillingClient
          initialBalance={mockBalance}
          initialTransactions={[]}
        />
      </LanguageProvider>
    );

    const text = extractText(tree);
    expect(text).toContain("እስካሁን ምንም የክፍያ እንቅስቃሴ የለም");
    expect(text).toContain("ሂሳብዎን ሲሞሉ የክፍያ ደረሰኞች እዚህ ይታያሉ።");
  });
});
