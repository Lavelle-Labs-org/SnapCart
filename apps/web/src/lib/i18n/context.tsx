"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import type { Locale, TranslationSchema } from "./schema";
import { en } from "./en";
import { am } from "./am";

const DICTIONARIES: Record<Locale, TranslationSchema> = {
  en,
  am,
};

export const LOCALE_COOKIE_NAME = "obs_locale";

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: TranslationSchema;
  isAmharic: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [name, val] = cookie.trim().split("=");
      if (name === LOCALE_COOKIE_NAME && (val === "en" || val === "am")) {
        return val as Locale;
      }
    }
    const htmlLang = document.documentElement.lang;
    if (htmlLang === "am" || htmlLang === "en") {
      return htmlLang as Locale;
    }
  } catch {
    // Ignore error
  }
  return "en";
}

export function LanguageProvider({
  children,
  initialLocale = "en",
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    const saved = getInitialLocale();
    if (saved && saved !== locale) {
      setLocaleState(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = React.useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    if (typeof window !== "undefined") {
      try {
        document.cookie = `${LOCALE_COOKIE_NAME}=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
        document.documentElement.lang = newLocale;
      } catch {
        // Ignore cookie write errors
      }
    }
  }, []);

  const toggleLocale = React.useCallback(() => {
    setLocaleState((prev) => {
      const next = prev === "en" ? "am" : "en";
      if (typeof window !== "undefined") {
        try {
          document.cookie = `${LOCALE_COOKIE_NAME}=${next}; path=/; max-age=31536000; SameSite=Lax`;
          document.documentElement.lang = next;
        } catch {
          // Ignore
        }
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      toggleLocale,
      t: DICTIONARIES[locale] || en,
      isAmharic: locale === "am",
    }),
    [locale, setLocale, toggleLocale]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    // Fallback if rendered outside provider (e.g. in standalone tests)
    return {
      locale: "en",
      setLocale: () => {},
      toggleLocale: () => {},
      t: en,
      isAmharic: false,
    };
  }
  return context;
}
