import Link from "next/link";
import { ListOrdered, CheckCircle, Clock, XCircle, ArrowRight } from "lucide-react";

export default function OrdersDashboardPage() {
  const mockOrders = [
    {
      id: "ord_1",
      number: 1043,
      buyerName: "Abebe Bikila",
      buyerPhone: "0911223344",
      totalBirr: 850,
      state: "new",
      createdAt: "10 mins ago",
    },
    {
      id: "ord_2",
      number: 1042,
      buyerName: "Sara Hailu",
      buyerPhone: "0799887766",
      totalBirr: 400,
      state: "accepted",
      createdAt: "35 mins ago",
    },
    {
      id: "ord_3",
      number: 1041,
      buyerName: "Dawit Kebede",
      buyerPhone: "0922334455",
      totalBirr: 1250,
      state: "ready",
      createdAt: "1 hour ago",
    },
    {
      id: "ord_4",
      number: 1040,
      buyerName: "Tigist Alemu",
      buyerPhone: "0933445566",
      totalBirr: 600,
      state: "completed",
      createdAt: "3 hours ago",
    },
  ];

  const getStatusBadge = (state: string) => {
    switch (state) {
      case "new":
        return <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">New</span>;
      case "accepted":
        return <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">Accepted</span>;
      case "ready":
        return <span className="px-2.5 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-semibold">Ready</span>;
      case "completed":
        return <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold">Completed</span>;
      case "rejected":
        return <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-full text-xs font-semibold">Rejected</span>;
      default:
        return <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-full text-xs font-semibold">{state}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
          <p className="text-sm text-slate-500">Live order management and handover status.</p>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Placed</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mockOrders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/80 transition">
                  <td className="px-4 py-3.5 font-bold text-slate-900">#{order.number}</td>
                  <td className="px-4 py-3.5 font-medium">{order.buyerName}</td>
                  <td className="px-4 py-3.5 text-slate-600 font-mono text-xs">{order.buyerPhone}</td>
                  <td className="px-4 py-3.5 font-semibold text-slate-900">{order.totalBirr} ETB</td>
                  <td className="px-4 py-3.5">{getStatusBadge(order.state)}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-500">{order.createdAt}</td>
                  <td className="px-4 py-3.5 text-right">
                    <Link
                      href={`/dashboard/orders/${order.id}`}
                      className="inline-flex items-center space-x-1 text-xs font-semibold text-emerald-600 hover:text-emerald-800"
                    >
                      <span>View Details</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
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
