import { Plus, Edit, Trash2 } from "lucide-react";

export default function ProductsPage() {
  const mockProducts = [
    { id: "1", name: "Special Combo Platter", priceBirr: 350, available: true },
    { id: "2", name: "Traditional Spiced Tea", priceBirr: 50, available: true },
    { id: "3", name: "Fresh Roasted Coffee (1kg)", priceBirr: 600, available: false },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products Catalog</h1>
          <p className="text-sm text-slate-500">Manage item pricing in Birr and storefront availability.</p>
        </div>
        <button
          type="button"
          className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-xl transition shadow-sm text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add Product</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Product Name</th>
                <th className="px-4 py-3">Price (ETB)</th>
                <th className="px-4 py-3">Availability</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mockProducts.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition">
                  <td className="px-4 py-3.5 font-medium text-slate-900">{p.name}</td>
                  <td className="px-4 py-3.5 font-semibold text-emerald-600">{p.priceBirr} ETB</td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        p.available ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {p.available ? "Available" : "Hidden"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right space-x-2">
                    <button type="button" className="text-slate-400 hover:text-slate-700 p-1">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button type="button" className="text-rose-400 hover:text-rose-700 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
