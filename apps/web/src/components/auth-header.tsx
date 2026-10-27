"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SnapcartLogo } from "./snapcart-logo";
import { LanguageToggle } from "./language-toggle";
import { ThemeToggle } from "./theme-toggle";
import { useTranslation } from "../lib/i18n";

export function AuthHeader() {
  const { isAmharic, t } = useTranslation();

  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center space-x-2 text-slate-900 dark:text-slate-100 hover:opacity-90 transition"
          aria-label="Snapcart Home"
        >
          <SnapcartLogo variant="horizontal" size="md" />
        </Link>

        <div className="flex items-center space-x-2 sm:space-x-3">
          <LanguageToggle />
          <ThemeToggle />
          <Link
            href="/"
            className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-touch flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{isAmharic ? t.common.home : "Home"}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

export function AuthFooter() {
  const { isAmharic } = useTranslation();
  return (
    <footer className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">
      <span>{isAmharic ? "Snapcart • በቅጽበት ይዘዙ" : "Snapcart • Order in a snap."}</span>
    </footer>
  );
}
