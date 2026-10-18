import { BellOff, CheckCircle2 } from "lucide-react";

interface StopTextsProps {
  params: Promise<{ token: string }>;
}

export default async function StopTextsPage({ params }: StopTextsProps) {
  const { token } = await params;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center max-w-md mx-auto border-x border-slate-200 p-6 text-center">
      <div className="w-16 h-16 bg-slate-200 text-slate-700 rounded-full flex items-center justify-center mb-4">
        <BellOff className="w-8 h-8" />
      </div>

      <h1 className="text-xl font-bold text-slate-900">Stop Order SMS Updates</h1>
      <p className="text-sm text-slate-600 mt-2 max-w-xs leading-relaxed">
        If you no longer wish to receive text updates for this order, click below to opt out.
      </p>

      <form className="mt-6 w-full space-y-3">
        <button
          type="button"
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 rounded-xl transition shadow-sm"
        >
          Confirm Stop Text Updates
        </button>
      </form>

      <p className="text-xs text-slate-400 mt-4">
        Your order will still be processed. You can check status directly with the seller.
      </p>
    </div>
  );
}
