import Link from "next/link";
import { CheckCircle2, Home, MessageSquare } from "lucide-react";

interface DonePageProps {
  params: Promise<{ slug: string }>;
}

export default async function DonePage({ params }: DonePageProps) {
  const { slug } = await params;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between max-w-md mx-auto border-x border-slate-200 p-6 text-center">
      <div className="flex-1 flex flex-col justify-center items-center space-y-4">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900">Order Placed!</h1>
        <div className="inline-block bg-slate-100 px-4 py-1.5 rounded-full text-sm font-semibold text-slate-700">
          Order #1043
        </div>

        <p className="text-sm text-slate-600 max-w-xs leading-relaxed">
          The seller has been notified via SMS. You will receive text messages when your order is accepted and ready for pickup.
        </p>

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-800 text-left flex items-start space-x-3 w-full mt-4">
          <MessageSquare className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">Pickup Code via SMS:</span>
            When the seller marks this order ready, you will receive a 4-digit code to present at handover.
          </div>
        </div>
      </div>

      <div className="pt-6">
        <Link
          href={`/s/${slug}`}
          className="w-full flex items-center justify-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-medium px-5 py-3 rounded-xl transition"
        >
          <Home className="w-4 h-4" />
          <span>Back to Storefront</span>
        </Link>
      </div>
    </div>
  );
}
