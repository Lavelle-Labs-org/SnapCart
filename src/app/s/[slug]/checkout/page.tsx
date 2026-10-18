import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

interface CheckoutProps {
  params: Promise<{ slug: string }>;
}

export default async function CheckoutPage({ params }: CheckoutProps) {
  const { slug } = await params;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between max-w-md mx-auto border-x border-slate-200">
      <header className="bg-white border-b px-4 py-3 flex items-center space-x-3">
        <Link href={`/s/${slug}`} className="p-2 -ml-2 text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-lg font-bold text-slate-900">Checkout</h1>
      </header>

      <main className="p-4 space-y-6 flex-1">
        {/* Order Summary */}
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">Order Summary</h2>
          <div className="flex justify-between text-sm py-1">
            <span>Special Combo Platter x 1</span>
            <span className="font-medium">350 ETB</span>
          </div>
          <div className="border-t my-2"></div>
          <div className="flex justify-between font-bold text-base text-slate-900">
            <span>Total</span>
            <span className="text-emerald-600">350 ETB</span>
          </div>
        </div>

        {/* Customer Information Form */}
        <form className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Your Details</h2>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Your Full Name</label>
            <input
              type="text"
              name="name"
              placeholder="e.g. Abebe Bikila"
              required
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Mobile Phone Number (Ethio Telecom or Safaricom)
            </label>
            <input
              type="tel"
              name="phone"
              placeholder="09... or 07..."
              required
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              We will send a 6-digit SMS verification code to this phone number.
            </p>
          </div>

          {/* SMS Consent Checkbox (Unticked by default as per FR-9) */}
          <div className="pt-2">
            <label className="flex items-start space-x-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                name="sms_consent"
                className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
              />
              <span>Send me SMS updates about this order (Accepted, Ready, and Handover code).</span>
            </label>
          </div>
        </form>

        <div className="flex items-center space-x-2 text-xs text-slate-500 bg-slate-100 p-3 rounded-lg">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>No account required. Cash on pickup or delivery.</span>
        </div>
      </main>

      <footer className="bg-white border-t p-4 sticky bottom-0">
        <Link
          href={`/s/${slug}/verify/mock-draft-123`}
          className="w-full block text-center bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-5 py-3 rounded-xl transition shadow-md"
        >
          Send Verification Code (SMS)
        </Link>
      </footer>
    </div>
  );
}
