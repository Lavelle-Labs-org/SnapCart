import Link from "next/link";
import { MessageSquare, ShoppingBag, ShieldCheck, ArrowRight, Smartphone, CheckCircle } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col justify-between">
      {/* Navigation */}
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-emerald-600 text-white p-2 rounded-lg">
              <MessageSquare className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900">Order-by-SMS</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-700 hover:text-slate-900 px-3 py-2 rounded-md hover:bg-slate-100 transition"
            >
              Seller Login
            </Link>
            <Link
              href="/signup"
              className="text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition shadow-sm"
            >
              Start Selling
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl mx-auto px-4 py-12 md:py-20 flex flex-col items-center text-center">
        <div className="inline-flex items-center space-x-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Powered by SMSHub.et & Ethio Telecom / Safaricom</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-slate-950 max-w-3xl leading-tight">
          A business you can run entirely from <span className="text-emerald-600">text messages</span>.
        </h1>

        <p className="mt-6 text-lg md:text-xl text-slate-600 max-w-2xl">
          Paste one storefront link into Telegram or Instagram. Customers order without an account, and every step
          happens by SMS. No app to install, no dashboard to monitor.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Link
            href="/s/demo"
            className="flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 py-3.5 rounded-xl transition shadow-md"
          >
            <ShoppingBag className="w-5 h-5" />
            <span>Try Buyer Storefront</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center justify-center space-x-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-medium px-6 py-3.5 rounded-xl transition shadow-sm"
          >
            <span>Seller Dashboard</span>
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 text-left w-full">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <Smartphone className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg text-slate-900">One-Tap Action Links</h3>
            <p className="text-sm text-slate-600 mt-2">
              Sellers receive an SMS alert with a secure signed link to accept, reject, or mark ready right from their phone without logging in.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg text-slate-900">OTP & Handover Proof</h3>
            <p className="text-sm text-slate-600 mt-2">
              Buyer phone numbers are verified via SMSHub OTP before order creation. Orders are completed only when the 4-digit pickup code matches.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
              <CheckCircle className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg text-slate-900">Honest Audit Log</h3>
            <p className="text-sm text-slate-600 mt-2">
              Every SMS message status is verified by webhook callbacks, displaying real delivery reports, credit billing, and instant resend controls.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white py-6 text-center text-sm text-slate-500">
        <p>Order-by-SMS • Built for Ethiopian micro-merchants on Ethio Telecom & Safaricom networks.</p>
      </footer>
    </div>
  );
}
