import React from "react";
import Link from "next/link";
import { MessageSquare, ArrowLeft } from "lucide-react";
import { LoginForm } from "./login-form";
import { ThemeToggle } from "../../components/theme-toggle";
import { LanguageToggle } from "../../components/language-toggle";
import { SnapcartLogo } from "../../components/snapcart-logo";

export const metadata = {
  title: "Seller Sign In | Snapcart",
  description: "Access your orders, message audit logs, and settings.",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between transition-colors duration-200">
      {/* Auth Top Header with Dark/Light Mode Toggle */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center space-x-2 text-slate-900 dark:text-slate-100 hover:opacity-90 transition"
            aria-label="Snapcart Home"
          >
            <SnapcartLogo variant="horizontal" size="sm" />
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

      {/* Main Login Card */}
      <main className="flex-1 flex flex-col justify-center items-center p-4 py-8">
        <LoginForm />
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">
        <span>Snapcart &bull; Seller Portal</span>
      </footer>
    </div>
  );
}
