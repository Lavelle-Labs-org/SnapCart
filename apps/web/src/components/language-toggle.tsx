"use client";

import React, { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { useTranslation } from "../lib/i18n";

export interface LanguageToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function LanguageToggle({ className = "", showLabel = false }: LanguageToggleProps) {
  const { locale, toggleLocale, isAmharic } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Language selector"
        className={`px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-slate-600 transition min-h-[44px] min-w-[44px] flex items-center justify-center text-xs font-semibold ${className}`}
      >
        <Globe className="w-3.5 h-3.5 opacity-70 mr-1" />
        <span>EN</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleLocale}
      title={isAmharic ? "Switch to English" : "ወደ አማርኛ ቀይር (Switch to Amharic)"}
      aria-label={isAmharic ? "Switch to English" : "ወደ አማርኛ ቀይር"}
      className={`px-2.5 py-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition min-h-[44px] min-w-[44px] flex items-center justify-center gap-1.5 focus-visible:ring-2 focus-visible:ring-emerald-500 border border-slate-200/60 dark:border-slate-800 text-xs font-bold ${className}`}
    >
      <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
      <span className="tabular-nums uppercase tracking-wide">
        {isAmharic ? "አማ" : "EN"}
      </span>
      {showLabel && (
        <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
          ({isAmharic ? "English" : "አማርኛ"})
        </span>
      )}
    </button>
  );
}

export default LanguageToggle;
