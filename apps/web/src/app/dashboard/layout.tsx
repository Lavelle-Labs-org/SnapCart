import Link from "next/link";
import { MessageSquare, ShoppingBag, ListOrdered, Mail, Settings, LogOut } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col justify-between">
        <div>
          <div className="p-5 border-b border-slate-800 flex items-center space-x-3">
            <div className="bg-emerald-500 text-white p-2 rounded-lg">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-base block">Order-by-SMS</span>
              <span className="text-xs text-slate-400 block">Seller Portal</span>
            </div>
          </div>

          <nav className="p-4 space-y-1">
            <Link
              href="/dashboard"
              className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 text-slate-200 transition"
            >
              <ListOrdered className="w-5 h-5 text-emerald-400" />
              <span>Orders</span>
            </Link>

            <Link
              href="/dashboard/messages"
              className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 text-slate-200 transition"
            >
              <Mail className="w-5 h-5 text-blue-400" />
              <span>SMS Message Log</span>
            </Link>

            <Link
              href="/dashboard/products"
              className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 text-slate-200 transition"
            >
              <ShoppingBag className="w-5 h-5 text-amber-400" />
              <span>Products</span>
            </Link>

            <Link
              href="/dashboard/settings"
              className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 text-slate-200 transition"
            >
              <Settings className="w-5 h-5 text-purple-400" />
              <span>Settings & Link</span>
            </Link>
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800">
          <Link
            href="/login"
            className="flex items-center space-x-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Seller Dashboard</h2>
          <div className="flex items-center space-x-3 text-xs">
            <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full font-medium border border-emerald-200">
              SMSHub Mode: Test
            </span>
          </div>
        </header>

        <main className="p-6 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
