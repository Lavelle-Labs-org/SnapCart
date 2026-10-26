import React from "react";
import Link from "next/link";
import { MessageSquare, ArrowLeft } from "lucide-react";
import { SignupForm } from "./signup-form";
import { ThemeToggle } from "../../components/theme-toggle";
import { LanguageToggle } from "../../components/language-toggle";

export const metadata = {
  title: "Create Seller Account | Order-by-SMS",
  description: "Set up your storefront and handle customer orders by SMS.",
};

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between transition-colors duration-200">
      {/* Auth Top Header with Dark/Light Mode Toggle */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center space-x-2 text-slate-900 dark:text-slate-100 hover:opacity-90 transition"
            aria-label="Order-by-SMS Home"
          >
            <div className="bg-emerald-600 text-white p-2 rounded-xl shadow-xs">
              <MessageSquare className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight">Order-by-SMS</span>
          </Link>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <LanguageToggle />
            <ThemeToggle />
            <Link
              href="/"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-touch flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Home</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Signup Card */}
      <main className="flex-1 flex flex-col justify-center items-center p-4 py-8">
        <SignupForm />
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">
        <span>Order-by-SMS &bull; Seller Portal</span>
      </footer>
    </div>
  );
}
