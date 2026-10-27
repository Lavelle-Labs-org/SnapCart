import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import Home from "../page";
import LandingClient from "../landing-client";
import { LanguageProvider } from "../../lib/i18n";

describe("Landing Page Refinement (Home / LandingClient)", () => {
  it("renders Home component returning LandingClient", () => {
    const element = Home();
    expect(element).toBeDefined();
    expect(element.type).toBe(LandingClient);
  });

  it("renders navigation header with brand, navigation links, and theme toggle", () => {
    const html = renderToString(<LandingClient />);
    expect(html).toContain("Order-by-SMS");
    expect(html).toContain('href="#how-it-works"');
    expect(html).toContain('href="#features"');
    expect(html).toContain('href="/s/habesha-cafe"');
    expect(html).toContain('href="#faq"');
    expect(html).toContain('aria-label="Toggle color theme"');
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/signup"');
  });

  it("renders hero section with headline, value proposition, and primary CTAs", () => {
    const html = renderToString(<LandingClient />);
    expect(html).toContain("A business you can run entirely from text messages.");
    expect(html).toContain("Start Selling Free");
    expect(html).toContain("Explore Demo Store");
    expect(html).toContain("Zero app installs for buyers");
    expect(html).toContain("Instant SMS order dispatch");
    expect(html).toContain("4-digit handover proof code");
  });

  it("renders realistic storefront and SMS dispatch UI mockups", () => {
    const html = renderToString(<LandingClient />);
    // Storefront mockup
    expect(html).toContain("Habesha Cafe &amp; Bakery");
    expect(html).toContain("Special Combo Platter");
    expect(html).toContain("350.00 ETB");
    expect(html).toContain("Single Doro Wat");
    expect(html).toContain("220.00 ETB");
    expect(html).toContain("OTP Verified");
    // SMS dispatch mockup
    expect(html).toContain("SMSHub Dispatch");
    expect(html).toContain("Ethio Telecom / Safaricom");
    expect(html).toContain("Tap to Accept:");
    expect(html).toContain("orderbysms.et/a/token");
    expect(html).toContain("4821");
  });

  it("renders How It Works section with 3 clear sequential steps", () => {
    const html = renderToString(<LandingClient />);
    expect(html).toContain("How Order-by-SMS Works");
    expect(html).toContain("Share Your Storefront Link");
    expect(html).toContain("Customers Order &amp; Verify OTP");
    expect(html).toContain("Fulfill via 1-Tap SMS Links");
    expect(html).toContain("01");
    expect(html).toContain("02");
    expect(html).toContain("03");
  });

  it("renders core features grid covering local capabilities", () => {
    const html = renderToString(<LandingClient />);
    expect(html).toContain("Built for Ethiopian Micro-Commerce");
    expect(html).toContain("One-Tap Signed Action Links");
    expect(html).toContain("Carrier Integration via SMSHub");
    expect(html).toContain("4-Digit Pickup Handover Proof");
    expect(html).toContain("Shareable In-App Storefronts");
    expect(html).toContain("Honest SMS Delivery Audit Logs");
    expect(html).toContain("Legal SMS Consent &amp; Opt-Out");
  });

  it("renders FAQ section with genuine product questions", () => {
    const html = renderToString(<LandingClient />);
    expect(html).toContain("Frequently Asked Questions");
    expect(html).toContain("Do my customers need to install an app or create an account?");
    expect(html).toContain("How do I receive and manage customer orders as a seller?");
    expect(html).toContain("Which mobile phone networks in Ethiopia are supported?");
    expect(html).toContain("How does the 4-digit pickup code verification work?");
    expect(html).toContain("Can I manage orders if my internet connection is spotty?");
  });

  it("renders closing CTA banner and full footer with categorized links", () => {
    const html = renderToString(<LandingClient />);
    expect(html).toContain("Start taking orders without the chaos today.");
    expect(html).toContain("Create Free Storefront");
    expect(html).toContain("See Demo Store");
    // Footer sections
    expect(html).toContain("Product");
    expect(html).toContain("Sellers");
    expect(html).toContain("Trust &amp; Privacy");
    expect(html).toContain('href="/x/demo"');
    expect(html).toContain("Ethio Telecom &amp; Safaricom networks");
    expect(html).toContain("© 2026 Order-by-SMS. All rights reserved.");
  });

  it("satisfies mobile touch target requirements of min-h-[44px] on interactive controls", () => {
    const html = renderToString(<LandingClient />);
    expect(html).toContain("min-h-[44px]");
    expect(html).toContain("min-w-[44px]");
  });

  it("renders full Amharic translation across all landing page sections when locale is 'am'", () => {
    const html = renderToString(
      <LanguageProvider initialLocale="am">
        <LandingClient />
      </LanguageProvider>
    );
    // Navbar
    expect(html).toContain("እንዴት ይሰራል");
    expect(html).toContain("ባህሪያት");
    expect(html).toContain("ጥያቄዎች");
    expect(html).toContain("የሻጭ መግቢያ");
    expect(html).toContain("መሸጥ ይጀምሩ");

    // Hero Section
    expect(html).toContain("ለኢትዮጵያ አነስተኛ ነጋዴዎች የተዘጋጀ");
    expect(html).toContain("ሙሉ በሙሉ በኤስኤምኤስ መልዕክቶች የሚመራ የንግድ ስርዓት።");
    expect(html).toContain("በነጻ መሸጥ ይጀምሩ");
    expect(html).toContain("የሙከራ መደብሩን ይመልከቱ");
    expect(html).toContain("ለገዢዎች ምንም የሚጫን መተግበሪያ የለም");
    expect(html).toContain("ፈጣን የኤስኤምኤስ ትዕዛዝ ማሳወቂያ");
    expect(html).toContain("ባለ 4-ዲጂት አስተማማኝ የመረከቢያ ኮድ");

    // Mockup
    expect(html).toContain("የቀጥታ ምርት ቅድመ-ዕይታ");
    expect(html).toContain("ሐበሻ ካፌና ቤከሪ");
    expect(html).toContain("ልዩ ጥብስና ክትፎ ኮምቦ");
    expect(html).toContain("የትዕዛዝ ድምር:");
    expect(html).toContain("ትዕዛዝ ይላኩ");
    expect(html).toContain("የSMSHub መልዕክት");

    // How It Works
    expect(html).toContain("ኦርደር-ባይ-ኤስኤምኤስ እንዴት ይሰራል?");
    expect(html).toContain("የመደብርዎን ሊንክ ያጋሩ");
    expect(html).toContain("ደንበኞች ያዛሉ፤ በኦቲፒ ያረጋግጣሉ");
    expect(html).toContain("በ1-ጠቅታ የኤስኤምኤስ ሊንክ ትዕዛዝ ያጠናቁ");

    // Features
    expect(html).toContain("ለኢትዮጵያ አነስተኛ ንግዶች የተሰራ");
    expect(html).toContain("በአንድ ጠቅታ የተፈረሙ ፈጣን አገናኞች");
    expect(html).toContain("ባለ 4-ዲጂት የመረከቢያ ማረጋገጫ ኮድ");

    // FAQ
    expect(html).toContain("ስለ ስርዓቱ ማወቅ የሚገባዎ ሁሉ");
    expect(html).toContain("ደንበኞቼ መተግበሪያ ማውረድ ወይም መለያ መክፈት አለባቸው?");
    expect(html).toContain("እንደ ሻጭ የደንበኞችን ትዕዛዝ እንዴት እቀበላለሁ፤ አስተዳድራለሁ?");

    // Closing CTA & Footer
    expect(html).toContain("ትዕዛዞችን ያለምንም ውዥንብር ዛሬውኑ መቀበል ይጀምሩ።");
    expect(html).toContain("ነጻ መደብር ይክፈቱ");
    expect(html).toContain("ምርት");
    expect(html).toContain("ነጋዴዎች");
    expect(html).toContain("ደህንነትና ግላዊነት");
    expect(html).toContain("© 2026 ኦርደር-ባይ-ኤስኤምኤስ። መብቱ በህግ የተጠበቀ ነው።");
  });
});

