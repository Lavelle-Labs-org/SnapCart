import Link from "next/link";
import { MessageSquare, ArrowRight } from "lucide-react";

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
        <div className="flex items-center space-x-2 mb-6">
          <div className="bg-emerald-600 text-white p-2 rounded-lg">
            <MessageSquare className="w-5 h-5" />
          </div>
          <span className="font-bold text-xl text-slate-900">Order-by-SMS</span>
        </div>

        <h1 className="text-2xl font-bold text-slate-900">Create Seller Account</h1>
        <p className="text-sm text-slate-600 mt-1">
          Set up your storefront and handle orders by SMS.
        </p>

        <form className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Business Name
            </label>
            <input
              type="text"
              name="business_name"
              placeholder="e.g. Habesha Cafe & Bakery"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              SMS Sender Name (Max 20 chars)
            </label>
            <input
              type="text"
              name="sms_name"
              maxLength={20}
              placeholder="e.g. Habesha Cafe"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Appears at the beginning of all buyer SMS messages.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Mobile Phone (Alert Number)
            </label>
            <input
              type="tel"
              name="phone"
              placeholder="09... or 07..."
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Every new order alert SMS with action links will be sent here.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Password (Min 10 chars)
            </label>
            <input
              type="password"
              name="password"
              minLength={10}
              placeholder="••••••••••"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            type="button"
            className="w-full flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-xl transition shadow-md mt-6"
          >
            <span>Verify Phone & Create Shop</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-emerald-600 font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
