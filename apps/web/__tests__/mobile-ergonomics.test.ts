import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Mobile Ergonomics & 44px Touch Targets Audit (FE-014, Issue #37, docs/10 Sec 3)", () => {
  const globalsCssPath = path.resolve(__dirname, "../src/app/globals.css");
  const globalsCss = fs.readFileSync(globalsCssPath, "utf-8");

  describe("Global Stylesheet & Viewport Standards (globals.css)", () => {
    it("enforces minimum 44px height on all interactive controls (Acceptance Criterion 1)", () => {
      // Must contain min-height: 44px rule targeting buttons, inputs, selects, textareas
      expect(globalsCss).toMatch(/min-height:\s*44px/);
      expect(globalsCss).toContain("button");
      expect(globalsCss).toContain("input:not([type=\"checkbox\"]");
      expect(globalsCss).toContain("select");
      expect(globalsCss).toContain("textarea");
    });

    it("enforces 16px font size on inputs to prevent mobile browser auto-zoom (Acceptance Criterion 2)", () => {
      // Must contain font-size: 16px rule for inputs/selects/textareas
      expect(globalsCss).toMatch(/font-size:\s*16px/);
    });

    it("prevents horizontal scrollbars at 360px width with overflow-x containment (Acceptance Criterion 3)", () => {
      // Must contain overflow-x: hidden and max-width: 100vw on html, body
      expect(globalsCss).toMatch(/overflow-x:\s*hidden/);
      expect(globalsCss).toMatch(/max-width:\s*100vw/);
    });

    it("provides touch target utility classes for explicit 44px dimensions", () => {
      expect(globalsCss).toContain(".touch-target");
      expect(globalsCss).toContain(".min-h-touch");
      expect(globalsCss).toContain(".min-w-touch");
    });
  });

  describe("Screen Audit: Storefront & Buyer Journey", () => {
    it("Screen 1 (/s/[slug]): catalog steppers satisfy >= 44px height and width", () => {
      const catalogFile = path.resolve(
        __dirname,
        "../src/app/s/[slug]/storefront-catalog.tsx"
      );
      const content = fs.readFileSync(catalogFile, "utf-8");

      // Verify steppers have min-h-[44px] and min-w-[44px]
      expect(content).toContain("min-h-[44px]");
      expect(content).toContain("min-w-[44px]");
      expect(content).toContain("w-11 h-11");
    });

    it("Screen 2 (/s/[slug]/checkout): inputs, checkbox touch area, and submit CTA have >= 44px height", () => {
      const checkoutFile = path.resolve(
        __dirname,
        "../src/app/s/[slug]/checkout/checkout-form.tsx"
      );
      const content = fs.readFileSync(checkoutFile, "utf-8");

      expect(content).toContain("min-h-[44px]");
      expect(content).toContain("min-h-[48px]"); // Sticky checkout CTA
    });

    it("Screen 3 (/s/[slug]/verify/[draftId]): OTP input, resend button, and change number link meet >= 44px", () => {
      const verifyFile = path.resolve(
        __dirname,
        "../src/app/s/[slug]/verify/[draftId]/verify-form.tsx"
      );
      const content = fs.readFileSync(verifyFile, "utf-8");

      expect(content).toContain("min-h-[44px]");
      expect(content).toContain("py-3.5"); // OTP input py-3.5 gives > 50px height
    });

    it("Screen 4 (/s/[slug]/done): Back to Storefront button has >= 44px height", () => {
      const doneFile = path.resolve(
        __dirname,
        "../src/app/s/[slug]/done/page.tsx"
      );
      const content = fs.readFileSync(doneFile, "utf-8");

      expect(content).toContain("min-h-[48px]");
    });

    it("Screen 5 (/x/[token]): Stop SMS Updates CTA has >= 44px height", () => {
      const optOutFile = path.resolve(
        __dirname,
        "../src/app/x/[token]/opt-out-client.tsx"
      );
      const content = fs.readFileSync(optOutFile, "utf-8");

      expect(content).toContain("min-h-[48px]");
    });
  });

  describe("Screen Audit: Seller Auth & Dashboard", () => {
    it("Screen 6 & 7 (/signup): registration inputs and OTP submit CTAs have >= 44px height", () => {
      const signupFile = path.resolve(
        __dirname,
        "../src/app/signup/signup-form.tsx"
      );
      const content = fs.readFileSync(signupFile, "utf-8");

      expect(content).toContain("min-h-[44px]");
      expect(content).toContain("min-h-[48px]");
    });

    it("Screen 8 (/login): login inputs and submit CTA have >= 44px height", () => {
      const loginFile = path.resolve(
        __dirname,
        "../src/app/login/login-form.tsx"
      );
      const content = fs.readFileSync(loginFile, "utf-8");

      expect(content).toContain("min-h-[48px]");
    });

    it("Screen 9 (/dashboard): orders table has overflow-x containment for 360px viewport", () => {
      const dashboardFile = path.resolve(
        __dirname,
        "../src/app/dashboard/page.tsx"
      );
      const clientFile = path.resolve(
        __dirname,
        "../src/app/dashboard/orders-client.tsx"
      );
      const content = fs.existsSync(clientFile)
        ? fs.readFileSync(dashboardFile, "utf-8") + fs.readFileSync(clientFile, "utf-8")
        : fs.readFileSync(dashboardFile, "utf-8");

      expect(content).toContain("overflow-x-auto");
    });

    it("Screen 10 (/dashboard/orders/[id]): action buttons have >= 44px height", () => {
      const actionsFile = path.resolve(
        __dirname,
        "../src/app/dashboard/orders/[id]/order-actions.tsx"
      );
      const content = fs.readFileSync(actionsFile, "utf-8");

      // Verify button padding and containers are sized for touch
      expect(content).toContain("min-h-[44px]");
    });

    it("Screen 11 (/dashboard/products): product catalog table has overflow-x containment", () => {
      const productsFile = path.resolve(
        __dirname,
        "../src/app/dashboard/products/product-manager.tsx"
      );
      const content = fs.readFileSync(productsFile, "utf-8");

      expect(content).toContain("overflow-x-auto");
    });

    it("Screen 12 (/dashboard/messages): message audit table has overflow-x containment", () => {
      const messagesFile = path.resolve(
        __dirname,
        "../src/app/dashboard/messages/messages-client.tsx"
      );
      const content = fs.readFileSync(messagesFile, "utf-8");

      expect(content).toContain("overflow-x-auto");
    });

    it("Screen 13 (/dashboard/settings): settings inputs, template tabs, and copy CTA have >= 44px height", () => {
      const settingsFile = path.resolve(
        __dirname,
        "../src/app/dashboard/settings/settings-client.tsx"
      );
      const content = fs.readFileSync(settingsFile, "utf-8");

      expect(content).toContain("min-h-[44px]");
    });

    it("Screen 14 (/a/[token]): seller mobile action page buttons have >= 44px height", () => {
      const actionFile = path.resolve(
        __dirname,
        "../src/app/a/[token]/action-client.tsx"
      );
      const content = fs.readFileSync(actionFile, "utf-8");

      expect(content).toContain("min-h-[44px]");
    });
  });

  describe("360px Viewport Layout Safety", () => {
    it("ensures mobile layouts do not hardcode fixed widths greater than 360px", () => {
      const filesToAudit = [
        "../src/app/s/[slug]/storefront-catalog.tsx",
        "../src/app/s/[slug]/checkout/checkout-form.tsx",
        "../src/app/s/[slug]/verify/[draftId]/verify-form.tsx",
        "../src/app/s/[slug]/done/page.tsx",
        "../src/app/x/[token]/opt-out-client.tsx",
        "../src/app/a/[token]/action-client.tsx",
      ];

      for (const relativePath of filesToAudit) {
        const fullPath = path.resolve(__dirname, relativePath);
        const code = fs.readFileSync(fullPath, "utf-8");

        // Should not contain rigid fixed widths like w-[400px], w-[500px], etc.
        const fixedWidthMatch = code.match(/w-\[(\d+)px\]/g);
        if (fixedWidthMatch) {
          for (const match of fixedWidthMatch) {
            const pxValue = parseInt(match.replace(/\D/g, ""), 10);
            expect(pxValue).toBeLessThanOrEqual(360);
          }
        }
      }
    });
  });
});
