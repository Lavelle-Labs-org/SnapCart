"use client";

import React from "react";
import Link from "next/link";
import { CheckCircle2, Home, MessageSquare, Store } from "lucide-react";
import { LanguageToggle } from "../../../../components/language-toggle";
import { ThemeToggle } from "../../../../components/theme-toggle";
import { useTranslation } from "../../../../lib/i18n";

export interface DoneClientProps {
  slug: string;
  orderNumber: string;
  hasConsented: boolean;
  shopName?: string;
  initialLocale?: "en" | "am";
}

/**
 * Order Confirmation Client Component (FE-004, FR-16).
 * Renders the order confirmation view and subscribes reactively to LanguageProvider
 * so that language toggle switches English/Amharic immediately without a page refresh.
 */
export function DoneClient({
  slug,
  orderNumber,
  hasConsented,
  shopName,
}: DoneClientProps) {
  const { t, isAmharic } = useTranslation();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between max-w-md mx-auto border-x border-slate-200 dark:border-slate-800 p-6 text-center transition-colors duration-200">
      <div className="w-full flex justify-end items-center gap-2 pb-2">
        <ThemeToggle />
        <LanguageToggle />
      </div>

      <div className="flex-1 flex flex-col justify-center items-center space-y-4">
        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center shadow-xs">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {t.orderDone.title}
          </h1>
          {shopName && (
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {t.orderDone.atShop(shopName)}
            </p>
          )}
        </div>

        <div
          data-testid="order-number"
          className="inline-block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs px-5 py-2 rounded-full text-base font-bold text-slate-900 dark:text-slate-100 tracking-wide tabular-nums"
        >
          {t.orderDone.orderBadge(orderNumber)}
        </div>

        {hasConsented ? (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300 max-w-xs leading-relaxed">
              {t.orderDone.consentedNotice}
            </p>

            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 text-xs text-emerald-800 dark:text-emerald-200 text-left flex items-start space-x-3 w-full mt-4">
              <MessageSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">
                  {t.orderDone.pickupCodeSmsTitle}
                </span>
                {t.orderDone.pickupCodeSmsDesc}
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300 max-w-xs leading-relaxed">
              {t.orderDone.optedOutNotice}
            </p>

            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-xs text-amber-800 dark:text-amber-200 text-left flex items-start space-x-3 w-full mt-4">
              <Store className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">
                  {t.orderDone.checkWithSellerTitle}
                </span>
                {t.orderDone.checkWithSellerDesc}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="pt-6 space-y-3">
        <Link
          href={`/s/${slug}`}
          className="w-full flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-3 rounded-xl transition shadow-xs min-h-[48px]"
        >
          <Home className="w-4 h-4" />
          <span>{t.orderDone.backToStorefront}</span>
        </Link>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium tracking-wide">
          {t.orderDone.brandPowered}
        </p>
      </div>
    </div>
  );
}
