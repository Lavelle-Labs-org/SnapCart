import { Phone, Check, X, BellRing, PackageCheck, AlertCircle } from "lucide-react";

interface ActionPageProps {
  params: Promise<{ token: string }>;
}

export default async function ActionPage({ params }: ActionPageProps) {
  const { token } = await params;

  // Placeholder mock order details for scaffold demo
  const mockOrder = {
    number: 1043,
    buyerName: "Abebe Bikila",
    buyerPhone: "0911223344",
    items: [
      { name: "Special Combo Platter", quantity: 2, priceBirr: 350 },
      { name: "Spiced Tea", quantity: 3, priceBirr: 50 },
    ],
    totalBirr: 850,
    state: "new" as "new" | "accepted" | "ready" | "completed" | "rejected",
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between max-w-md mx-auto border-x border-slate-200">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Seller Action</span>
          <h1 className="text-lg font-bold text-slate-900">Order #{mockOrder.number}</h1>
        </div>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 uppercase">
          {mockOrder.state}
        </span>
      </header>

      {/* Main Order Card */}
      <main className="p-4 space-y-4 flex-1">
        {/* Buyer Contact */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Customer</p>
            <p className="font-semibold text-slate-900">{mockOrder.buyerName}</p>
            <p className="text-xs text-slate-600 font-mono">{mockOrder.buyerPhone}</p>
          </div>
          <a
            href={`tel:${mockOrder.buyerPhone}`}
            className="flex items-center space-x-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-2 rounded-lg text-sm font-medium transition"
          >
            <Phone className="w-4 h-4" />
            <span>Call</span>
          </a>
        </div>

        {/* Item Breakdown */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ordered Items</h2>
          <div className="space-y-2 text-sm">
            {mockOrder.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center py-1">
                <span>
                  <strong className="text-slate-900">{item.quantity}x</strong> {item.name}
                </span>
                <span className="font-medium text-slate-700">{item.quantity * item.priceBirr} ETB</span>
              </div>
            ))}
          </div>
          <div className="border-t pt-3 flex justify-between items-center font-bold text-base text-slate-900">
            <span>Total Payable (Cash)</span>
            <span className="text-emerald-600 text-lg">{mockOrder.totalBirr} ETB</span>
          </div>
        </div>

        {/* State Information */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <span>
            Tapping <strong>Accept</strong> triggers an automated SMS notification to the customer.
          </span>
        </div>
      </main>

      {/* Action Footer Buttons (Thumb-friendly) */}
      <footer className="bg-white border-t p-4 sticky bottom-0 space-y-2">
        {mockOrder.state === "new" && (
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              className="col-span-1 bg-rose-50 text-rose-700 hover:bg-rose-100 font-medium py-3 rounded-xl transition flex items-center justify-center space-x-1"
            >
              <X className="w-4 h-4" />
              <span>Reject</span>
            </button>
            <button
              type="button"
              className="col-span-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-xl transition shadow-md flex items-center justify-center space-x-2"
            >
              <Check className="w-5 h-5" />
              <span>Accept Order</span>
            </button>
          </div>
        )}

        {mockOrder.state === "accepted" && (
          <button
            type="button"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3.5 rounded-xl transition shadow-md flex items-center justify-center space-x-2"
          >
            <BellRing className="w-5 h-5" />
            <span>Mark Ready & Send Pickup Code</span>
          </button>
        )}

        {mockOrder.state === "ready" && (
          <div className="space-y-3">
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="Enter 4-Digit Pickup Code"
              className="w-full text-center text-2xl font-mono tracking-widest py-2.5 border-2 border-slate-300 rounded-xl focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="button"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3.5 rounded-xl transition shadow-md flex items-center justify-center space-x-2"
            >
              <PackageCheck className="w-5 h-5" />
              <span>Complete Handover</span>
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}
