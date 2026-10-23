import Link from "next/link";
import { Store, ArrowLeft } from "lucide-react";

export default function StorefrontNotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 max-w-md mx-auto border-x border-slate-200 text-center">
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm w-full space-y-4">
        <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
          <Store className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Shop Not Found</h1>
          <p className="text-sm text-slate-500 mt-2">
            We couldn&apos;t find a storefront at this address. The seller may have changed their shop link, or the address was typed incorrectly.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center space-x-2 w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 rounded-xl transition text-sm shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Order-by-SMS</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
