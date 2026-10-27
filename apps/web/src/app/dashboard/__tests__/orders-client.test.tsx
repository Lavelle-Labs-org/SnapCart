import React from "react";
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { OrdersClient } from "../orders-client";
import { LanguageProvider } from "../../../lib/i18n";

describe("OrdersClient Component (FE-009, Reactive Language)", () => {
  const mockOrders = [
    {
      id: "ord_101",
      number: 1045,
      buyer_name: "Abebe Bikila",
      buyer_phone: "0911223344",
      total_santim: 85000,
      state: "new",
      created_at: new Date(Date.now() - 5 * 60 * 1000),
    },
    {
      id: "ord_102",
      number: 1044,
      buyer_name: "Sara Hailu",
      buyer_phone: "0799887766",
      total_santim: 40000,
      state: "accepted",
      created_at: new Date(Date.now() - 30 * 60 * 1000),
    },
    {
      id: "ord_103",
      number: 1043,
      buyer_name: "Dawit Kebede",
      buyer_phone: "0922334455",
      total_santim: 125000,
      state: "ready",
      created_at: new Date(Date.now() - 75 * 60 * 1000),
    },
  ];

  it("renders orders queue with English text when language is English", () => {
    const html = renderToString(
      <LanguageProvider initialLocale="en">
        <OrdersClient initialOrders={mockOrders} />
      </LanguageProvider>
    );

    expect(html).toContain("Orders");
    expect(html).toContain("Live order queue and handover status.");
    expect(html).toContain("3 orders live");
    expect(html).toContain("New");
    expect(html).toContain("Accepted");
    expect(html).toContain("Ready");
    expect(html).toContain("View Details");
    expect(html).toContain("Customer");
  });

  it("reactively renders orders queue with Amharic text when language is Amharic", () => {
    const html = renderToString(
      <LanguageProvider initialLocale="am">
        <OrdersClient initialOrders={mockOrders} />
      </LanguageProvider>
    );

    expect(html).toContain("የትዕዛዝ ዳሽቦርድ");
    expect(html).toContain("የደንበኞችዎን ትዕዛዞች በቀጥታ ይከታተሉና ያስተዳድሩ።");
    expect(html).toContain("3 ትዕዛዞች በሂደት ላይ");
    expect(html).toContain("አዲስ");
    expect(html).toContain("ተቀባይነት አግኝቷል");
    expect(html).toContain("ዝግጁ");
    expect(html).toContain("ዝርዝር ይመልከቱ");
    expect(html).toContain("ደንበኛ");
  });

  it("renders empty state in English and Amharic", () => {
    const htmlEn = renderToString(
      <LanguageProvider initialLocale="en">
        <OrdersClient initialOrders={[]} />
      </LanguageProvider>
    );
    expect(htmlEn).toContain("No orders yet");
    expect(htmlEn).toContain("View Storefront Link");
    expect(htmlEn).toContain("Manage Products");

    const htmlAm = renderToString(
      <LanguageProvider initialLocale="am">
        <OrdersClient initialOrders={[]} />
      </LanguageProvider>
    );
    expect(htmlAm).toContain("እስካሁን ምንም ትዕዛዝ የለም");
    expect(htmlAm).toContain("የመደብር ሊንክ ይመልከቱ");
    expect(htmlAm).toContain("እቃዎችን ያስተዳድሩ");
  });
});
