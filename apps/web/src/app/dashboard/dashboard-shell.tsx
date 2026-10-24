"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  ListOrdered,
  Mail,
  ShoppingBag,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
} from "lucide-react";

export interface DashboardShellProps {
  seller?: { business_name?: string; slug?: string } | null;
  displayName: string;
  displaySubtitle: string;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Orders",
    icon: ListOrdered,
    exact: true,
  },
  {
    href: "/dashboard/messages",
    label: "SMS Message Log",
    icon: Mail,
    exact: false,
  },
  {
    href: "/dashboard/products",
    label: "Products",
    icon: ShoppingBag,
    exact: false,
  },
  {
    href: "/dashboard/settings",
    label: "Settings & Link",
    icon: Settings,
    exact: false,
  },
];

export function DashboardShell({
  seller,
  displayName,
  displaySubtitle,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Restore collapsed state from localStorage on client mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("order_by_sms_sidebar_collapsed");
      if (stored === "true") {
        setIsCollapsed(true);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("order_by_sms_sidebar_collapsed", String(next));
      } catch {
        // Ignore localStorage errors
      }
      return next;
    });
  };

  const isItemActive = (itemHref: string, exact: boolean) => {
    if (!pathname) return false;
    if (exact) {
      return pathname === itemHref;
    }
    return pathname.startsWith(itemHref);
  };

  return (
    <div className="min-h-screen bg-[#f6f8f7] dark:bg-[#07130f] flex flex-col md:flex-row transition-colors duration-200">
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Close navigation overlay"
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape" || e.key === "Enter") setIsMobileOpen(false);
          }}
        />
      )}

      {/* Mobile Navigation Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex flex-col justify-between shadow-2xl border-r border-slate-200 dark:border-slate-800 transition-transform duration-300 ease-in-out md:hidden ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Mobile navigation"
      >
        <div>
          {/* Drawer Header */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="bg-emerald-600 text-white p-2 rounded-xl flex-shrink-0 shadow-xs">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-bold text-base block truncate text-slate-900 dark:text-slate-100" title={displayName}>
                  {displayName}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 block truncate">
                  {displaySubtitle}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileOpen(false)}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-touch min-w-touch flex items-center justify-center focus-visible:ring-2 focus-visible:ring-emerald-500"
              aria-label="Close navigation menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Links */}
          <nav className="p-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = isItemActive(item.href, item.exact);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={`flex items-center space-x-3 px-3.5 py-3 rounded-xl text-sm font-medium transition min-h-touch ${
                    active
                      ? "bg-emerald-600 text-white font-semibold shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${active ? "text-white" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Drawer Footer Sign Out */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <Link
            href="/login"
            onClick={() => setIsMobileOpen(false)}
            className="flex items-center space-x-3 px-3.5 py-3 rounded-xl text-sm text-slate-600 dark:text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition min-h-touch"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span>Sign Out</span>
          </Link>
        </div>
      </aside>

      {/* Desktop Collapsible Sidebar */}
      <aside
        className={`hidden md:flex flex-col justify-between bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ease-in-out ${
          isCollapsed ? "w-20" : "w-64"
        }`}
        aria-label="Sidebar navigation"
      >
        <div>
          {/* Sidebar Header */}
          <div
            className={`border-b border-slate-100 dark:border-slate-800 flex items-center transition-all ${
              isCollapsed ? "p-3.5 justify-center" : "p-4 justify-between"
            }`}
          >
            <div className={`flex items-center space-x-3 min-w-0 ${isCollapsed ? "justify-center" : ""}`}>
              <div className="bg-emerald-600 text-white p-2 rounded-xl flex-shrink-0 shadow-xs">
                <MessageSquare className="w-5 h-5" />
              </div>
              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-sm block truncate text-slate-900 dark:text-slate-100" title={displayName}>
                    {displayName}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block truncate">
                    {displaySubtitle}
                  </span>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <button
                type="button"
                onClick={toggleCollapsed}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 rounded-lg transition"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Desktop Nav Items */}
          <nav className="p-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = isItemActive(item.href, item.exact);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={isCollapsed ? item.label : undefined}
                  aria-label={item.label}
                  className={`flex items-center rounded-xl text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                    isCollapsed
                      ? "justify-center p-3"
                      : "space-x-3 px-3.5 py-2.5"
                  } ${
                    active
                      ? "bg-emerald-600 text-white font-semibold shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 flex-shrink-0 ${
                      active ? "text-white" : "text-slate-400"
                    }`}
                  />
                  {!isCollapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
          {isCollapsed && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={toggleCollapsed}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded-xl transition"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <PanelLeftOpen className="w-5 h-5" />
              </button>
            </div>
          )}

          <Link
            href="/login"
            title={isCollapsed ? "Sign Out" : undefined}
            aria-label="Sign Out"
            className={`flex items-center text-sm text-slate-500 dark:text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition focus-visible:ring-2 focus-visible:ring-emerald-500 ${
              isCollapsed ? "justify-center p-3" : "space-x-3 px-3.5 py-2.5"
            }`}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!isCollapsed && <span>Sign Out</span>}
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile App Bar */}
        <div className="md:hidden bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-4 py-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-xs">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setIsMobileOpen(true)}
              className="p-2 -ml-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-touch min-w-touch flex items-center justify-center focus-visible:ring-2 focus-visible:ring-emerald-500"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2">
              <div className="bg-emerald-600 text-white p-1.5 rounded-lg">
                <MessageSquare className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm tracking-tight truncate max-w-[140px] text-slate-900 dark:text-slate-100">
                {displayName}
              </span>
            </div>
          </div>
          <div>
            {seller?.slug && (
              <a
                href={`/s/${seller.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 transition px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100"
              >
                Storefront
              </a>
            )}
          </div>
        </div>

        {/* Content Shell Children */}
        {children}
      </div>
    </div>
  );
}
