"use client";

import React from "react";
import Link from "next/link";
import { Store, Zap, AlertTriangle } from "lucide-react";
import { useTranslation } from "../../lib/i18n";
import { ThemeToggle } from "../../components/theme-toggle";
import { LanguageToggle } from "../../components/language-toggle";

export interface DashboardHeaderProps {
  seller?: {
    business_name?: string;
    slug?: string;
    sms_credits?: number;
    sms_credits_used?: number;
  } | null;
}

export function DashboardHeader({ seller }: DashboardHeaderProps) {
  const { t, isAmharic } = useTranslation();

  return (
    <>
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 py-3.5 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">
            {isAmharic ? t.dashboard.sellerDashboard : "Seller Dashboard"}
          </h2>
          {seller?.business_name && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              <span>{seller.business_name}</span>
              {seller.slug && (
                <span className="ml-1.5 text-slate-400 dark:text-slate-500">
                  {`@${seller.slug}`}
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-2 md:space-x-3 text-xs">
          {seller && (
            <Link
              href="/dashboard/billing"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium transition border ${
                (seller.sms_credits ?? 0) > 3
                  ? "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700"
                  : (seller.sms_credits ?? 0) > 0
                  ? "bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700"
                  : "bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-700"
              }`}
              title={
                isAmharic
                  ? "የSMS ክሬዲት (በቻፓ ለመሙላት ይጫኑ)"
                  : "SMS Credits (Click to top up via Chapa)"
              }
            >
              <Zap
                className={`w-3.5 h-3.5 ${
                  (seller.sms_credits ?? 0) <= 0
                    ? "text-rose-500 fill-rose-500"
                    : (seller.sms_credits ?? 0) <= 3
                    ? "text-amber-500 fill-amber-500"
                    : "text-amber-500 fill-amber-500"
                }`}
              />
              <span className="font-bold">{seller.sms_credits ?? 0}</span>
              <span>SMS</span>
            </Link>
          )}
          {seller?.slug && (
            <a
              href={`/s/${seller.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1.5 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-full font-medium transition"
            >
              <Store className="w-3.5 h-3.5" />
              <span>{isAmharic ? t.dashboard.viewStorefront : "View Storefront"}</span>
            </a>
          )}
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>

      {seller && (seller.sms_credits ?? 0) <= 3 && (
        <div
          className={`px-4 md:px-6 py-2 text-xs flex items-center justify-between border-b ${
            (seller.sms_credits ?? 0) <= 0
              ? "bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800"
              : "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800"
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              {(seller.sms_credits ?? 0) <= 0
                ? isAmharic
                  ? t.dashboard.smsExhaustedAlert
                  : "Your SMS credits are exhausted. Buyer orders will succeed, but SMS updates are paused until you recharge."
                : isAmharic
                ? t.dashboard.smsLowAlert(seller.sms_credits ?? 0)
                : `You have ${seller.sms_credits} SMS credits remaining. Recharge soon to avoid SMS notification delays.`}
            </span>
          </div>
          <Link
            href="/dashboard/billing"
            className="underline font-bold hover:opacity-80 ml-4 flex-shrink-0 text-xs"
          >
            {isAmharic ? t.dashboard.topUpChapaBtn : "Top Up with Chapa →"}
          </Link>
        </div>
      )}
    </>
  );
}
