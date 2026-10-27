"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  MessageSquare,
  ShoppingBag,
  ShieldCheck,
  ArrowRight,
  Smartphone,
  CheckCircle2,
  Menu,
  X,
  Store,
  Clock,
  Sparkles,
  Zap,
  HelpCircle,
  ChevronDown,
  ExternalLink,
  Lock,
  History,
  Radio,
  FileText,
  Check,
} from "lucide-react";
import { ThemeToggle } from "../components/theme-toggle";
import { LanguageToggle } from "../components/language-toggle";
import { SnapcartLogo } from "../components/snapcart-logo";
import { useTranslation } from "../lib/i18n";

interface FaqItem {
  question: string;
  answer: string;
}

const FAQS: FaqItem[] = [
  {
    question: "Do my customers need to install an app or create an account?",
    answer:
      "No. Customers simply open your storefront link inside Telegram, Instagram, TikTok, or any standard mobile browser. They choose items, enter their mobile phone number, and verify with a quick SMS OTP. They never have to register, install an app, or remember a password.",
  },
  {
    question: "How do I receive and manage customer orders as a seller?",
    answer:
      "Whenever a customer places an order, you instantly receive an SMS text containing the order summary, total amount in Ethiopian Birr, and customer phone. The SMS includes a secure, cryptographically signed action link that lets you accept, prepare, or reject the order directly from your mobile phone without logging in.",
  },
  {
    question: "Which mobile phone networks in Ethiopia are supported?",
    answer:
      "Snapcart integrates directly with SMSHub.et, providing high-reliability carrier delivery across both Ethio Telecom (09... and 07...) and Safaricom Ethiopia (07...) numbers with automated status callbacks.",
  },
  {
    question: "How does the 4-digit pickup code verification work?",
    answer:
      "When you mark an order as 'Ready' for pickup, our system automatically texts a unique 4-digit code to the customer. When they arrive at your shop, you enter their 4-digit code into your order screen to confirm the handover. This guarantees orders are given to the right buyer.",
  },
  {
    question: "Can I manage orders if my internet connection is spotty?",
    answer:
      "Yes. Because order notifications and customer communications are dispatched as regular SMS text messages, you receive alerts even on low-bandwidth mobile data. The signed one-tap action links load lightweight mobile pages engineered for minimal data consumption.",
  },
];

export default function LandingClient() {
  const { t, isAmharic } = useTranslation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const faqs = isAmharic ? t.landing.faqs : FAQS;

  const toggleFaq = (index: number) => {
    setOpenFaqIndex((prev) => (prev === index ? null : index));
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between transition-colors duration-200">
      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Close navigation overlay"
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape" || e.key === "Enter") setIsMobileMenuOpen(false);
          }}
        />
      )}

      {/* Mobile Navigation Drawer (Slides from Left, identical to Dashboard) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex flex-col justify-between shadow-2xl border-r border-slate-200 dark:border-slate-800 transition-transform duration-300 ease-in-out md:hidden ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Mobile navigation"
      >
        <div>
          {/* Drawer Header */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <Link
              href="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center space-x-2.5"
              aria-label="Snapcart Home"
            >
              <SnapcartLogo variant="horizontal" size="md" />
            </Link>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-touch min-w-touch flex items-center justify-center focus-visible:ring-2 focus-visible:ring-emerald-500"
              aria-label="Close navigation menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Links */}
          <nav className="p-3 space-y-1">
            <a
              href="#how-it-works"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center space-x-3 px-3.5 py-3 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-touch"
            >
              <Sparkles className="w-5 h-5 flex-shrink-0 text-slate-400" />
              <span>{isAmharic ? t.landing.howItWorksNav : "How It Works"}</span>
            </a>
            <a
              href="#features"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center space-x-3 px-3.5 py-3 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-touch"
            >
              <Zap className="w-5 h-5 flex-shrink-0 text-slate-400" />
              <span>{isAmharic ? t.landing.featuresNav : "Features"}</span>
            </a>
            <Link
              href="/s/habesha-cafe"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-touch"
            >
              <div className="flex items-center space-x-3">
                <ShoppingBag className="w-5 h-5 flex-shrink-0 text-slate-400" />
                <span>{isAmharic ? t.landing.demoStoreNav : "Demo Store"}</span>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                {isAmharic ? t.landing.mobileLivePreview : "Live Preview"}
              </span>
            </Link>
            <a
              href="#faq"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center space-x-3 px-3.5 py-3 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-touch"
            >
              <HelpCircle className="w-5 h-5 flex-shrink-0 text-slate-400" />
              <span>{isAmharic ? t.landing.faqNav : "FAQ"}</span>
            </a>
          </nav>
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
          <Link
            href="/login"
            onClick={() => setIsMobileMenuOpen(false)}
            className="w-full text-center text-sm font-semibold border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 px-4 py-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-touch flex items-center justify-center"
          >
            {isAmharic ? t.landing.signInBtn : "Seller Login"}
          </Link>
          <Link
            href="/signup"
            onClick={() => setIsMobileMenuOpen(false)}
            className="w-full text-center text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-4 py-3 rounded-xl transition shadow-xs min-h-touch flex items-center justify-center gap-1.5"
          >
            <span>{isAmharic ? t.landing.heroCtaPrimary : "Start Selling Free"}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </aside>

      {/* 1. Navbar */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand Logo & Mobile Menu Hamburger (Left-aligned like Dashboard) */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-touch min-w-touch flex items-center justify-center focus-visible:ring-2 focus-visible:ring-emerald-500"
              aria-label="Open navigation menu"
              aria-expanded={isMobileMenuOpen}
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link
              href="/"
              className="flex items-center space-x-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-lg p-1"
              aria-label="Snapcart Home"
            >
              <SnapcartLogo variant="horizontal" size="md" />
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a
              href="#how-it-works"
              className="px-3 py-2 rounded-lg hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-[44px] inline-flex items-center"
            >
              {isAmharic ? t.landing.howItWorksNav : "How It Works"}
            </a>
            <a
              href="#features"
              className="px-3 py-2 rounded-lg hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-[44px] inline-flex items-center"
            >
              {isAmharic ? t.landing.featuresNav : "Features"}
            </a>
            <Link
              href="/s/habesha-cafe"
              className="px-3 py-2 rounded-lg hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-[44px] inline-flex items-center gap-1.5"
            >
              <span>{isAmharic ? t.landing.demoStoreNav : "Demo Store"}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                {isAmharic ? t.landing.liveBadge : "Live"}
              </span>
            </Link>
            <a
              href="#faq"
              className="px-3 py-2 rounded-lg hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-[44px] inline-flex items-center"
            >
              {isAmharic ? t.landing.faqNav : "FAQ"}
            </a>
          </nav>

          {/* Desktop Action Controls */}
          <div className="hidden md:flex items-center space-x-2.5">
            <LanguageToggle />
            <ThemeToggle />
            <Link
              href="/login"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 px-3.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-[44px] inline-flex items-center"
            >
              {isAmharic ? t.landing.signInBtn : "Seller Login"}
            </Link>
            <Link
              href="/signup"
              className="text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-4 py-2 rounded-xl transition shadow-xs min-h-[44px] inline-flex items-center gap-1.5"
            >
              <span>{isAmharic ? t.landing.createStoreBtn : "Start Selling"}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Mobile Right Controls: Language Toggle & Theme Toggle */}
          <div className="flex items-center space-x-2 md:hidden">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        {/* 2. Hero Section */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-16 md:pt-20 md:pb-24 flex flex-col items-center text-center">
          {/* Trust Network Badge */}
          <div className="inline-flex items-center space-x-2 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold px-3.5 py-1.5 rounded-full mb-6 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{isAmharic ? t.landing.heroBadge : "Built for Ethiopian Micro-Merchants • Ethio Telecom & Safaricom via SMSHub.et"}</span>
          </div>

          {/* Hero Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 max-w-4xl leading-[1.15]">
            {isAmharic ? t.landing.heroTitle : "A business you can run entirely from text messages."}
          </h1>

          {/* Hero Subhead */}
          <p className="mt-6 text-base sm:text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
            {isAmharic ? t.landing.heroSubtitle : "Share one storefront link in your Telegram channel or Instagram bio. Customers order without an account, and you manage fulfillment with secure 1-tap SMS action links. No apps to install. No complex dashboards."}
          </p>

          {/* Hero CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row gap-3.5 w-full sm:w-auto">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold px-7 py-3.5 rounded-xl transition shadow-sm focus-visible:ring-2 focus-visible:ring-emerald-500 min-h-[44px]"
            >
              <span>{isAmharic ? t.landing.heroCtaPrimary : "Start Selling Free"}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/s/habesha-cafe"
              className="inline-flex items-center justify-center space-x-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-semibold px-6 py-3.5 rounded-xl transition shadow-xs focus-visible:ring-2 focus-visible:ring-slate-400 min-h-[44px]"
            >
              <ShoppingBag className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>{isAmharic ? t.landing.heroCtaSecondary : "Explore Demo Store"}</span>
              <ExternalLink className="w-4 h-4 text-slate-400" />
            </Link>
          </div>

          {/* Trust Highlights */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              {isAmharic ? t.landing.trustZeroApps : "Zero app installs for buyers"}
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              {isAmharic ? t.landing.trustInstantSms : "Instant SMS order dispatch"}
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              {isAmharic ? t.landing.trustHandoverCode : "4-digit handover proof code"}
            </span>
          </div>

          {/* 3. Realistic Product Visual Mockup */}
          <div className="w-full mt-14 max-w-5xl text-left">
            <div className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/50 p-3 sm:p-5 shadow-xl">
              {/* Mockup Top Window Bar */}
              <div className="flex items-center justify-between pb-3 px-2 border-b border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-rose-400" />
                  <span className="w-3 h-3 rounded-full bg-amber-400" />
                  <span className="w-3 h-3 rounded-full bg-emerald-400" />
                  <span className="ml-2 font-mono text-[11px] text-slate-400 dark:text-slate-500 hidden sm:inline">
                    orderbysms.et/s/habesha-cafe
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{isAmharic ? t.landing.mockupLivePreview : "Live Product Preview"}</span>
                </div>
              </div>

              {/* Mockup Dual Columns: Storefront (Left) + SMS Lifecycle (Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-4">
                {/* Left Card: Customer Mobile Storefront Experience */}
                <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    {/* Storefront Header */}
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="font-bold text-base text-slate-900 dark:text-slate-100">
                            {isAmharic ? "ሐበሻ ካፌና ቤከሪ" : "Habesha Cafe & Bakery"}
                          </h2>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                            {isAmharic ? t.landing.mockupVerified : "Verified"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {isAmharic ? t.landing.mockupPickupTime : "Bole Medhanialem, Addis Ababa • Pickup in 20-30m"}
                        </p>
                      </div>
                      <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                        HC
                      </div>
                    </div>

                    {/* Storefront Menu Items */}
                    <div className="py-4 space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/40">
                        <div className="pr-3">
                          <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                            {isAmharic ? "ልዩ ጥብስና ክትፎ ኮምቦ" : "Special Combo Platter"}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                            {isAmharic ? "ጥብስ፣ ክትፎ እና ምስር ወጥ ከሁለት እንጀራ ጋር" : "Tibs, kitfo, and spicy lentils with two injera"}
                          </p>
                          <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400 tabular-nums mt-1 block">
                            350.00 ETB
                          </span>
                        </div>
                        <div className="flex items-center space-x-1.5 text-xs font-semibold">
                          <span className="px-2.5 py-1 rounded-md bg-emerald-600 text-white">
                            {isAmharic ? t.landing.mockupCartItem : "1 in cart"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/40">
                        <div className="pr-3">
                          <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                            {isAmharic ? "ነጠላ የዶሮ ወጥ" : "Single Doro Wat"}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                            {isAmharic ? "የተመረጠ የዶሮ ጭን ከተቀቀለ እንቁላል ጋር" : "Slow-cooked chicken drumstick with hard-boiled egg"}
                          </p>
                          <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400 tabular-nums mt-1 block">
                            220.00 ETB
                          </span>
                        </div>
                        <button
                          type="button"
                          className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium"
                        >
                          {isAmharic ? t.landing.mockupAddBtn : "+ Add"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Customer Quick Order Checkout Preview */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between text-xs mb-2.5">
                      <span className="text-slate-500 dark:text-slate-400">
                        {isAmharic ? t.landing.mockupSubtotal : "Order Subtotal:"}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                        350.00 ETB
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs flex items-center justify-between">
                        <span>0911 22 33 44</span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans font-semibold">
                          {isAmharic ? t.landing.mockupOtpVerified : "OTP Verified"}
                        </span>
                      </div>
                      <div className="px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1">
                        <span>{isAmharic ? t.landing.mockupPlaceOrder : "Place Order"}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Card: SMS Thread & Action Link Lifecycle */}
                <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    {/* Phone SMS Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                          <Smartphone className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-xs text-slate-900 dark:text-slate-100">
                            {isAmharic ? t.landing.mockupSmsHeader : "SMSHub Dispatch"}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {isAmharic ? t.landing.mockupSmsCarrier : "Carrier: Ethio Telecom / Safaricom"}
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                        {isAmharic ? t.landing.mockupDelivered : "Delivered"}
                      </span>
                    </div>

                    {/* Simulated SMS Messages */}
                    <div className="py-3 space-y-3 font-mono text-xs">
                      {/* Seller Alert Message Bubble */}
                      <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 space-y-1.5 border border-slate-200/60 dark:border-slate-700/60">
                        <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                          {isAmharic ? t.landing.mockupIncomingTitle : "Incoming Seller SMS • Order #1001"}
                        </div>
                        <p className="leading-tight text-[11px]">
                          {isAmharic ? (
                            <>
                              [ሐበሻ ካፌ] አዲስ ትዕዛዝ #1001 (350.00 ብር)!
                              <br />
                              1x ልዩ ጥብስና ክትፎ ኮምቦ
                              <br />
                              ገዢ፡ 0911***344
                            </>
                          ) : (
                            <>
                              [Habesha Cafe] New Order #1001 (350.00 ETB)!
                              <br />
                              1x Special Combo Platter
                              <br />
                              Buyer: 0911***344
                            </>
                          )}
                        </p>
                        {/* 1-Tap Action Link Box */}
                        <div className="pt-1.5">
                          <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-[11px] font-sans flex items-center justify-between">
                            <span className="font-semibold">{isAmharic ? t.landing.mockupTapToAccept : "Tap to Accept:"}</span>
                            <span className="underline font-mono text-[10px] text-emerald-700 dark:text-emerald-300">
                              orderbysms.et/a/token
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Customer Handover Code SMS */}
                      <div className="p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 space-y-1 border border-emerald-200/80 dark:border-emerald-900/60">
                        <div className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400">
                          {isAmharic ? t.landing.mockupReadyTitle : "Customer Ready SMS • 4-Digit Proof"}
                        </div>
                        <p className="leading-tight text-[11px]">
                          {isAmharic ? t.landing.mockupReadyMsg : "[Habesha Cafe] Order #1001 is ready for pickup!"}
                        </p>
                        <div className="py-1 flex items-center gap-2">
                          <span className="text-[11px] font-sans">{isAmharic ? t.landing.mockupPickupCode : "Pickup Code:"}</span>
                          <span className="font-bold text-sm bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 tracking-wider">
                            4821
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <span>{isAmharic ? t.landing.mockupCryptoSecurity : "Cryptographically signed links prevent unauthorized actions."}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. How It Works Section */}
        <section id="how-it-works" className="py-16 md:py-24 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <div className="inline-flex items-center space-x-1.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold px-3 py-1 rounded-full mb-3">
                <Clock className="w-3.5 h-3.5" />
                <span>{isAmharic ? t.landing.howItWorksBadge : "Simple 3-Step Flow"}</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                {isAmharic ? t.landing.howItWorksTitle : "How Snapcart Works"}
              </h2>
              <p className="mt-3 text-base text-slate-600 dark:text-slate-400">
                {isAmharic ? t.landing.howItWorksSubtitle : "From sharing a menu link to verifying pickup, run your business without downloading apps or checking dashboards all day."}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Step 1 */}
              <div className="relative p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-extrabold text-lg mb-5">
                    01
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
                    {isAmharic ? t.landing.step1Title : "Share Your Storefront Link"}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {isAmharic ? (
                      t.landing.step1Desc
                    ) : (
                      <>
                        Set up your business name and menu items in minutes. You get a lightweight shareable link like{" "}
                        <code className="text-xs px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono">
                          /s/your-shop
                        </code>{" "}
                        ready to drop directly into Telegram channels or Instagram bios.
                      </>
                    )}
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-200/80 dark:border-slate-800 flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <Store className="w-4 h-4 mr-1.5" />
                  <span>{isAmharic ? t.landing.step1Note : "Zero marketplace listing fees"}</span>
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 flex items-center justify-center font-extrabold text-lg mb-5">
                    02
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
                    {isAmharic ? t.landing.step2Title : "Customers Order & Verify OTP"}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {isAmharic ? t.landing.step2Desc : "Shoppers pick their items and enter their Ethiopian phone number. A quick SMSHub OTP verification confirms their phone in seconds. No account registration, password creation, or app install needed."}
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-200/80 dark:border-slate-800 flex items-center text-xs font-medium text-blue-600 dark:text-blue-400">
                  <ShieldCheck className="w-4 h-4 mr-1.5" />
                  <span>{isAmharic ? t.landing.step2Note : "Eliminates fake orders and bot spam"}</span>
                </div>
              </div>

              {/* Step 3 */}
              <div className="relative p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 flex items-center justify-center font-extrabold text-lg mb-5">
                    03
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
                    {isAmharic ? t.landing.step3Title : "Fulfill via 1-Tap SMS Links"}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {isAmharic ? t.landing.step3Desc : "You receive an SMS alert with a cryptographically signed link to Accept or Reject on your phone. When marked Ready, the buyer receives a 4-digit pickup code to show at handover."}
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-200/80 dark:border-slate-800 flex items-center text-xs font-medium text-teal-600 dark:text-teal-400">
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  <span>{isAmharic ? t.landing.step3Note : "Verified 4-digit handover proof"}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Core Features Section */}
        <section id="features" className="py-16 md:py-24 border-t border-slate-200 dark:border-slate-800">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <div className="inline-flex items-center space-x-1.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold px-3 py-1 rounded-full mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isAmharic ? t.landing.featuresBadge : "Purpose-Built Capabilities"}</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                {isAmharic ? t.landing.featuresTitle : "Built for Ethiopian Micro-Commerce"}
              </h2>
              <p className="mt-3 text-base text-slate-600 dark:text-slate-400">
                {isAmharic ? t.landing.featuresSubtitle : "Engineered from the ground up for low data, mobile-first buyers, and local carrier realities."}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Feature 1 */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  {isAmharic ? t.landing.feature1Title : "One-Tap Signed Action Links"}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                  {isAmharic ? t.landing.feature1Desc : "Sellers receive an SMS alert with a tamper-proof HMAC link. Accept, reject, or mark orders ready with one tap on your phone without logging into a dashboard."}
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
                  <Radio className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  {isAmharic ? t.landing.feature2Title : "Carrier Integration via SMSHub"}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                  {isAmharic ? t.landing.feature2Desc : "Direct SMSHub.et integration supports Ethio Telecom (09... / 07...) and Safaricom Ethiopia (07...) numbers with verified delivery callbacks."}
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-4">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  {isAmharic ? t.landing.feature3Title : "4-Digit Pickup Handover Proof"}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                  {isAmharic ? t.landing.feature3Desc : "Every order is locked with a random 4-digit code sent only to the buyer. At pickup, you verify the code to prevent disputes and wrong handovers."}
                </p>
              </div>

              {/* Feature 4 */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
                  <Store className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  {isAmharic ? t.landing.feature4Title : "Shareable In-App Storefronts"}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                  {isAmharic ? t.landing.feature4Desc : "Lightweight web menus optimized to open instantly inside Telegram and Instagram in-app webviews with zero friction and fast loading."}
                </p>
              </div>

              {/* Feature 5 */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition">
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4">
                  <History className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  {isAmharic ? t.landing.feature5Title : "Honest SMS Delivery Audit Logs"}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                  {isAmharic ? t.landing.feature5Desc : "Inspect real delivery timestamps, carrier receipts, webhook events, and trigger instant manual resends if a customer has reception problems."}
                </p>
              </div>

              {/* Feature 6 */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition">
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-4">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  {isAmharic ? t.landing.feature6Title : "Legal SMS Consent & Opt-Out"}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                  {isAmharic ? t.landing.feature6Desc : "Fully compliant with telecom privacy standards. Order checkout collects explicit buyer SMS consent with automated opt-out stop handling."}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 6. FAQ Section */}
        <section id="faq" className="py-16 md:py-24 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <div className="inline-flex items-center space-x-1.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold px-3 py-1 rounded-full mb-3">
                <span>{isAmharic ? t.landing.faqBadge : "Frequently Asked Questions"}</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                {isAmharic ? t.landing.faqTitle : "Everything You Need to Know"}
              </h2>
              <p className="mt-3 text-base text-slate-600 dark:text-slate-400">
                {isAmharic ? t.landing.faqSubtitle : "Straightforward answers on how Snapcart operates for merchants and buyers across Ethiopia."}
              </p>
            </div>

            {/* Accordion List */}
            <div className="space-y-3.5">
              {faqs.map((faq, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div
                    key={faq.question}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900 transition overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleFaq(idx)}
                      className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 min-h-[44px]"
                      aria-expanded={isOpen}
                    >
                      <span className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                        {faq.question}
                      </span>
                      <ChevronDown
                        className={`w-5 h-5 text-slate-500 dark:text-slate-400 transition-transform duration-200 flex-shrink-0 ${
                          isOpen ? "rotate-180 text-emerald-600 dark:text-emerald-400" : ""
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-1 text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-200/50 dark:border-slate-800/50">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 7. Closing CTA Banner */}
        <section className="py-16 md:py-20 border-t border-slate-200 dark:border-slate-800">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="relative rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white p-8 sm:p-12 md:p-16 text-center shadow-lg overflow-hidden">
              <div className="relative z-10 max-w-2xl mx-auto space-y-6">
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
                  {isAmharic ? t.landing.closingCtaTitle : "Start taking orders without the chaos today."}
                </h2>
                <p className="text-emerald-100 text-base sm:text-lg leading-relaxed">
                  {isAmharic ? t.landing.closingCtaSubtitle : "Join Ethiopian food stalls, bakeries, cafes, and independent merchants running their order queues seamlessly over SMS."}
                </p>

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
                  <Link
                    href="/signup"
                    className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-white text-emerald-800 hover:bg-emerald-50 active:bg-emerald-100 font-bold px-7 py-3.5 rounded-xl transition shadow-md min-h-[44px]"
                  >
                    <span>{isAmharic ? t.landing.closingCtaPrimary : "Create Free Storefront"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/s/habesha-cafe"
                    className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 border border-emerald-300/60 hover:bg-emerald-700/50 text-white font-semibold px-6 py-3.5 rounded-xl transition min-h-[44px]"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>{isAmharic ? t.landing.closingCtaSecondary : "See Demo Store"}</span>
                  </Link>
                </div>

                <div className="text-xs text-emerald-200 pt-2">
                  {isAmharic ? t.landing.closingCtaDisclaimer : "Works on all phones • Ethio Telecom & Safaricom • Zero customer app downloads"}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 8. Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-12 text-sm text-slate-600 dark:text-slate-400">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-slate-200 dark:border-slate-800">
            {/* Column 1: Brand Info */}
            <div className="md:col-span-1 space-y-3">
              <Link href="/" className="inline-block" aria-label="Snapcart Home">
                <SnapcartLogo variant="horizontal" size="md" />
              </Link>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {isAmharic ? t.landing.footerBrandDesc : "Lightweight SMS ordering infrastructure built for Ethiopian micro-merchants on Ethio Telecom & Safaricom networks."}
              </p>
            </div>

            {/* Column 2: Product */}
            <div className="space-y-2.5">
              <h4 className="font-semibold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100">
                {isAmharic ? t.landing.footerColProduct : "Product"}
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <a href="#how-it-works" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition">
                    {isAmharic ? t.landing.howItWorksNav : "How It Works"}
                  </a>
                </li>
                <li>
                  <a href="#features" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition">
                    {isAmharic ? t.landing.featuresNav : "Features"}
                  </a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition">
                    {isAmharic ? t.landing.faqNav : "FAQ"}
                  </a>
                </li>
                <li>
                  <Link href="/s/habesha-cafe" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition flex items-center gap-1">
                    <span>{isAmharic ? t.landing.footerLiveDemo : "Live Demo Store"}</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 3: Sellers */}
            <div className="space-y-2.5">
              <h4 className="font-semibold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100">
                {isAmharic ? t.landing.footerColSellers : "Sellers"}
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <Link href="/signup" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition">
                    {isAmharic ? t.landing.closingCtaPrimary : "Start Selling Free"}
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition">
                    {isAmharic ? t.landing.signInBtn : "Seller Sign In"}
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition">
                    {isAmharic ? t.landing.footerDashboard : "Seller Dashboard"}
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 4: Trust & Compliance */}
            <div className="space-y-2.5">
              <h4 className="font-semibold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100">
                {isAmharic ? t.landing.footerColTrust : "Trust & Privacy"}
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <Link href="/x/demo" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition">
                    {isAmharic ? t.landing.footerOptOut : "SMS Privacy & Opt-Out"}
                  </Link>
                </li>
                <li className="text-slate-400 dark:text-slate-500">
                  {isAmharic ? t.landing.footerGateway : "SMS Gateway: SMSHub.et"}
                </li>
                <li className="text-slate-400 dark:text-slate-500">
                  {isAmharic ? t.landing.footerCarriers : "Carriers: Ethio Telecom • Safaricom"}
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Copyright */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <p>{isAmharic ? t.landing.footerCopyright : "© 2026 Snapcart. All rights reserved."}</p>
            <p>{isAmharic ? t.landing.footerDesignedFor : "Designed for local micro-commerce in Addis Ababa, Ethiopia."}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
