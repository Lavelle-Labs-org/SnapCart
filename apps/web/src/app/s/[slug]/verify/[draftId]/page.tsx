import Link from "next/link";
import { ArrowLeft, MessageSquare } from "lucide-react";

interface VerifyPageProps {
  params: Promise<{ slug: string; draftId: string }>;
}

export default async function VerifyPage({ params }: VerifyPageProps) {
  const { slug } = await params;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between max-w-md mx-auto border-x border-slate-200">
      <header className="bg-white border-b px-4 py-3 flex items-center space-x-3">
        <Link href={`/s/${slug}/checkout`} className="p-2 -ml-2 text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-lg font-bold text-slate-900">Verify Phone Number</h1>
      </header>

      <main className="p-6 text-center space-y-6 flex-1 flex flex-col justify-center">
        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
          <MessageSquare className="w-6 h-6" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-slate-900">Enter 6-Digit Code</h2>
          <p className="text-sm text-slate-600 mt-2">
            We sent an SMS verification code to your phone number.
          </p>
        </div>

        {/* 6-digit numeric input */}
        <div className="max-w-xs mx-auto">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            className="w-full text-center text-3xl font-mono tracking-widest py-3 border-2 border-slate-300 rounded-xl focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="text-xs text-slate-500">
          Resend code available in <span className="font-semibold text-slate-700">60s</span>
        </div>
      </main>

      <footer className="bg-white border-t p-4 sticky bottom-0">
        <Link
          href={`/s/${slug}/done`}
          className="w-full block text-center bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-5 py-3 rounded-xl transition shadow-md"
        >
          Confirm & Place Order
        </Link>
      </footer>
    </div>
  );
}
