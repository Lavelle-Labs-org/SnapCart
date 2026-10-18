import Link from "next/link";
import { ShoppingBag, ArrowRight } from "lucide-react";

interface StorefrontProps {
  params: Promise<{ slug: string }>;
}

export default async function StorefrontPage({ params }: StorefrontProps) {
  const { slug } = await params;

  // Placeholder catalog item for scaffold
  const mockProducts = [
    { id: "p1", name: "Special Combo Platter", priceBirr: 350, available: true },
    { id: "p2", name: "Traditional Spiced Tea", priceBirr: 50, available: true },
    { id: "p3", name: "Fresh Roasted Coffee (1kg)", priceBirr: 600, available: true },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between max-w-md mx-auto border-x border-slate-200">
      {/* Shop Header */}
      <header className="bg-white border-b px-4 py-4 sticky top-0 z-10 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 capitalize">{slug.replace(/-/g, " ")}</h1>
          <p className="text-xs text-slate-500">Order online • Cash on delivery/pickup</p>
        </div>
        <div className="bg-emerald-50 text-emerald-700 p-2 rounded-full">
          <ShoppingBag className="w-5 h-5" />
        </div>
      </header>

      {/* Catalog List */}
      <main className="p-4 space-y-4 flex-1">
        <div className="space-y-3">
          {mockProducts.map((product) => (
            <div
              key={product.id}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between"
            >
              <div>
                <h3 className="font-medium text-slate-900">{product.name}</h3>
                <p className="text-sm font-semibold text-emerald-600 mt-1">{product.priceBirr} ETB</p>
              </div>
              <button
                type="button"
                className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium px-4 py-2 rounded-lg text-sm transition"
              >
                + Add
              </button>
            </div>
          ))}
        </div>
      </main>

      {/* Bottom Sticky Checkout Bar */}
      <footer className="bg-white border-t p-4 sticky bottom-0">
        <Link
          href={`/s/${slug}/checkout`}
          className="w-full flex items-center justify-between bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-5 py-3 rounded-xl transition shadow-md"
        >
          <span>View Cart (1 item)</span>
          <div className="flex items-center space-x-2">
            <span className="font-bold">350 ETB</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>
      </footer>
    </div>
  );
}
