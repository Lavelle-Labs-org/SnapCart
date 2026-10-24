import React from "react";
import Link from "next/link";
import {
  MessageSquare,
  ShoppingBag,
  ShieldCheck,
  ArrowRight,
  Smartphone,
  CheckCircle,
  KeyRound,
  Sparkles,
} from "lucide-react";
import { ThemeToggle } from "../components/theme-toggle";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors duration-200">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Order-by-SMS Home">
            <span className="flex w-9 h-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
              <MessageSquare className="w-5 h-5" />
            </span>
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Order-by-SMS
            </span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Link
              href="/login"
              className="flex min-h-touch items-center px-3.5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Seller Login
            </Link>
            <Link
              href="/signup"
              className="flex min-h-touch items-center rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-semibold transition shadow-xs"
            >
              Start Selling
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-12 pb-16 md:pt-20 md:pb-24">
          <div className="text-center max-w-3xl mx-auto">
            {/* Status Pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 shadow-xs mb-6">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Built for Ethio Telecom &amp; Safaricom via SMSHub.et</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 leading-tight sm:leading-none">
              Your storefront, <span className="text-emerald-600 dark:text-emerald-400">in every phone.</span>
            </h1>

            <p className="mt-6 text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl mx-auto">
              A simpler way for Ethiopian micro-merchants to turn conversations into orders.
              Share one storefront link in Telegram, TikTok, or Instagram. No app to install,
              no account friction — every step happens by SMS.
            </p>

            {/* Hero CTAs */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <Link
                href="/s/habesha-cafe"
                className="w-full sm:w-auto flex min-h-touch items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-6 py-3 text-sm font-bold shadow-xs transition"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Try Buyer Storefront</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto flex min-h-touch items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 px-6 py-3 text-sm font-semibold transition shadow-xs"
              >
                <span>Seller Dashboard Login</span>
              </Link>
            </div>
          </div>

          {/* Workflow Showcase Grid */}
          <div className="mt-14 max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Step 1 */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm mb-4">
                    1
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Buyer Browses &amp; Verifies
                  </h3>
                  <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    Customer taps your link, chooses products, and enters their phone. An SMS OTP verifies their number before placing the order.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center text-xs text-slate-500 dark:text-slate-400 font-mono">
                  <span>Guest Checkout • 0 Friction</span>
                </div>
              </div>

              {/* Step 2 */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm mb-4">
                    2
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Seller One-Tap Actions
                  </h3>
                  <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    You receive an immediate SMS with signed action links. Accept, decline, or mark ready with a single tap from your phone.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center text-xs text-slate-500 dark:text-slate-400 font-mono">
                  <span>No Password Required • Instant</span>
                </div>
              </div>

              {/* Step 3 */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-sm mb-4">
                    3
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    4-Digit Pickup Proof
                  </h3>
                  <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    When ready, the buyer receives a secret 4-digit code by SMS. Entering it at pickup verifies and completes the order cleanly.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center text-xs text-slate-500 dark:text-slate-400 font-mono">
                  <span>Cryptographic Proof • Fraud-Free</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid Section */}
        <section className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 py-12 md:py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center flex-shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    One-Tap Action Links
                  </h3>
                  <p className="mt-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    Manage your queue on the go. Signed HMAC links let you accept and pack orders directly from text messages.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Accountable Handover
                  </h3>
                  <p className="mt-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    Protected against ghost orders. OTP verification ensures real customers, and pickup codes guarantee real handovers.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Transparent Audit Log
                  </h3>
                  <p className="mt-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    Every SMS has delivery status verified via webhooks, with automatic retry resilience and one-click manual resend.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <p>Order-by-SMS • Built for Ethiopian micro-merchants on Ethio Telecom &amp; Safaricom networks.</p>
          <div className="flex items-center gap-4">
            <Link href="/s/habesha-cafe" className="hover:text-slate-900 dark:hover:text-slate-100 transition">
              Storefront Demo
            </Link>
            <Link href="/login" className="hover:text-slate-900 dark:hover:text-slate-100 transition">
              Seller Login
            </Link>
            <Link href="/signup" className="hover:text-slate-900 dark:hover:text-slate-100 transition">
              Create Account
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
