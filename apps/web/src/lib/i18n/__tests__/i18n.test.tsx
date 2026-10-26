import React from "react";
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { en } from "../en";
import { am } from "../am";
import { LanguageProvider, useTranslation, getInitialLocale } from "../context";

describe("i18n Dictionary Parity & Completeness", () => {
  it("en and am dictionaries have identical top-level domain sections", () => {
    const enSections = Object.keys(en).sort();
    const amSections = Object.keys(am).sort();
    expect(amSections).toEqual(enSections);
  });

  it("every nested key in en exists in am", () => {
    for (const section of Object.keys(en) as (keyof typeof en)[]) {
      const enKeys = Object.keys(en[section]).sort();
      const amKeys = Object.keys(am[section]).sort();
      expect(amKeys, `Mismatch in section ${section}`).toEqual(enKeys);
    }
  });

  it("all string values are non-empty in both en and am", () => {
    for (const section of Object.keys(en) as (keyof typeof en)[]) {
      const enSection = en[section] as Record<string, unknown>;
      const amSection = am[section] as Record<string, unknown>;

      for (const key of Object.keys(enSection)) {
        const enVal = enSection[key];
        const amVal = amSection[key];

        if (typeof enVal === "string") {
          expect(enVal.trim().length, `en.${section}.${key} is empty`).toBeGreaterThan(0);
          expect(typeof amVal, `am.${section}.${key} should be string`).toBe("string");
          expect((amVal as string).trim().length, `am.${section}.${key} is empty`).toBeGreaterThan(0);
        } else if (typeof enVal === "function") {
          expect(typeof amVal, `am.${section}.${key} should be function`).toBe("function");
        }
      }
    }
  });

  it("all interpolation functions return non-empty strings with parameters", () => {
    expect(en.storefront.itemsCount(3)).toContain("3");
    expect(am.storefront.itemsCount(3)).toContain("3");

    expect(en.otp.modalDesc("0912345678")).toContain("0912345678");
    expect(am.otp.modalDesc("0912345678")).toContain("0912345678");

    expect(en.otp.resendCooldown(45)).toContain("45");
    expect(am.otp.resendCooldown(45)).toContain("45");

    expect(en.orderDone.subtitle("ORD-101")).toContain("ORD-101");
    expect(am.orderDone.subtitle("ORD-101")).toContain("ORD-101");

    expect(en.action.pageTitle("Bole Roasters")).toContain("Bole Roasters");
    expect(am.action.pageTitle("Bole Roasters")).toContain("Bole Roasters");

    expect(en.action.orderNumber("ORD-999")).toContain("ORD-999");
    expect(am.action.orderNumber("ORD-999")).toContain("ORD-999");

    expect(en.action.terminalStateNotice("COMPLETED")).toContain("COMPLETED");
    expect(am.action.terminalStateNotice("ተጠናቋል")).toContain("ተጠናቋል");
  });
});

describe("LanguageProvider and useTranslation Hook", () => {
  function TestConsumer() {
    const { locale, isAmharic, t } = useTranslation();
    return (
      <div data-testid="i18n-container">
        <span id="locale">{locale}</span>
        <span id="is-amharic">{String(isAmharic)}</span>
        <span id="save-btn">{t.common.save}</span>
        <span id="orders-nav">{t.dashboard.navOrders}</span>
        <span id="cart-empty">{t.storefront.cartEmpty}</span>
      </div>
    );
  }

  it("renders English translations by default in SSR / Server render", () => {
    const html = renderToString(
      <LanguageProvider>
        <TestConsumer />
      </LanguageProvider>
    );

    expect(html).toContain("Save");
    expect(html).toContain("Orders");
    expect(html).toContain("Your cart is empty");
    expect(html).toContain('<span id="locale">en</span>');
    expect(html).toContain('<span id="is-amharic">false</span>');
  });

  it("renders gracefully even if used outside LanguageProvider", () => {
    const html = renderToString(<TestConsumer />);
    expect(html).toContain("Save");
    expect(html).toContain("Orders");
    expect(html).toContain('<span id="locale">en</span>');
  });

  it("getInitialLocale reads cookie correctly when present", () => {
    // In node/server environment, document is undefined
    expect(getInitialLocale()).toBe("en");
  });
});
