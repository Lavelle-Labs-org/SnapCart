import React from "react";
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { DoneClient } from "../done-client";
import { LanguageProvider } from "../../../../../lib/i18n";

describe("DoneClient Component (FE-004, Reactive Language)", () => {
  it("renders order confirmation with English text when language is English", () => {
    const html = renderToString(
      <LanguageProvider initialLocale="en">
        <DoneClient
          slug="habesha-cafe"
          orderNumber="1001"
          hasConsented={true}
          shopName="Habesha Cafe"
        />
      </LanguageProvider>
    );

    expect(html).toContain("Order Placed in a Snap!");
    expect(html).toContain("at Habesha Cafe");
    expect(html).toContain("Order #1001");
    expect(html).toContain(
      "The seller has been notified via SMS. You will receive text updates when your order is accepted and ready for pickup."
    );
    expect(html).toContain("Pickup Code via SMS:");
    expect(html).toContain("Back to Storefront");
    expect(html).toContain("Powered by Snapcart • Order in a snap.");
  });

  it("reactively renders order confirmation with Amharic text when language is Amharic", () => {
    const html = renderToString(
      <LanguageProvider initialLocale="am">
        <DoneClient
          slug="habesha-cafe"
          orderNumber="1001"
          hasConsented={true}
          shopName="Habesha Cafe"
        />
      </LanguageProvider>
    );

    expect(html).toContain("ትዕዛዝዎ በቅጽበት ተመዝግቧል!");
    expect(html).toContain("በHabesha Cafe");
    expect(html).toContain("ትዕዛዝ #1001");
    expect(html).toContain(
      "ሻጩ በኤስኤምኤስ ተነግሮታል። ትዕዛዝዎ ተቀባይነት ሲያገኝና ለመረከብ ዝግጁ ሲሆን የጽሑፍ መልዕክት ይደርስዎታል።"
    );
    expect(html).toContain("የመቀበያ ኮድ በኤስኤምኤስ:");
    expect(html).toContain("ወደ መደብሩ ተመለስ");
    expect(html).toContain("በSnapcart የተጎላበተ • በቅጽበት ይዘዙ");
  });

  it("renders opted-out guidance in English when buyer declined SMS updates", () => {
    const html = renderToString(
      <LanguageProvider initialLocale="en">
        <DoneClient
          slug="habesha-cafe"
          orderNumber="1002"
          hasConsented={false}
          shopName="Habesha Cafe"
        />
      </LanguageProvider>
    );

    expect(html).toContain(
      "The seller has been notified. You opted out of SMS updates, so text notifications are turned off."
    );
    expect(html).toContain("Check with Seller:");
    expect(html).not.toContain("Pickup Code via SMS:");
  });

  it("renders opted-out guidance in Amharic when buyer declined SMS updates", () => {
    const html = renderToString(
      <LanguageProvider initialLocale="am">
        <DoneClient
          slug="habesha-cafe"
          orderNumber="1002"
          hasConsented={false}
          shopName="Habesha Cafe"
        />
      </LanguageProvider>
    );

    expect(html).toContain(
      "ሻጩ ተነግሮታል። ከኤስኤምኤስ ማሳወቂያዎች ስለወጡ የጽሑፍ መልዕክቶች አይላኩም።"
    );
    expect(html).toContain("ከሻጩ ጋር ያረጋግጡ:");
    expect(html).not.toContain("የመቀበያ ኮድ በኤስኤምኤስ:");
  });
});
