import Link from "next/link";
import { MessageSquare, ArrowRight } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
        <div className="flex items-center space-x-2 mb-6">
          <div className="bg-emerald-600 text-white p-2 rounded-lg">
            <MessageSquare className="w-5 h-5" />
          </div>
          <span className="font-bold text-xl text-slate-900">Order-by-SMS</span>
        </div>

        <h1 className="text-2xl font-bold text-slate-900">Seller Sign In</h1>
        <p className="text-sm text-slate-600 mt-1">
          Access your orders, message audit logs, and settings.
        </p>

        <form className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Registered Phone Number
            </label>
            <input
              type="tel"
              name="phone"
              placeholder="09... or 07..."
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Password
            </label>
            <input
              type="password"
              name="password"
              placeholder="••••••••••"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <Link
            href="/dashboard"
            className="w-full flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-xl transition shadow-md mt-6"
          >
            <span>Sign In to Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </form>

        <p className="text-center text-xs text-slate-500 mt-6">
          New seller?{" "}
          <Link href="/signup" className="text-emerald-600 font-semibold hover:underline">
            Register shop
          </Link>
        </p>
      </div>
    </div>
  );
}
