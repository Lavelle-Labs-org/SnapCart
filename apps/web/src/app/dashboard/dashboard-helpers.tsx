import React from "react";
import { CheckCircle, Clock, XCircle, PackageCheck } from "lucide-react";

export interface OrdersDashboardPageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Extracts sellerId from JWT token payload without throwing or external dependencies.
 */
export function extractSellerIdFromToken(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = Buffer.from(base64, "base64").toString("utf8");
    const parsed = JSON.parse(jsonPayload);
    if (parsed && typeof parsed.sellerId === "string" && parsed.sellerId.trim() !== "") {
      return parsed.sellerId.trim();
    }
  } catch {
    // Return null on malformed token
  }
  return null;
}

/**
 * Formats relative timestamp or date string for human readability in order queue.
 */
export function formatOrderTime(dateInput: Date | string): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (!date || isNaN(date.getTime())) return "Recently";

  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins === 1) return "1 min ago";
  if (diffMins < 60) return `${diffMins} mins ago`;
  if (diffHours === 1) return "1 hour ago";
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Renders state badge with distinct color and semantic status indicator.
 */
export function getStatusBadge(state: string) {
  switch (state) {
    case "new":
      return (
        <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold inline-flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>New</span>
        </span>
      );
    case "accepted":
      return (
        <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold inline-flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          <span>Accepted</span>
        </span>
      );
    case "ready":
      return (
        <span className="px-2.5 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-semibold inline-flex items-center gap-1">
          <PackageCheck className="w-3 h-3" />
          <span>Ready</span>
        </span>
      );
    case "completed":
      return (
        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold inline-flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          <span>Completed</span>
        </span>
      );
    case "rejected":
      return (
        <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-full text-xs font-semibold inline-flex items-center gap-1">
          <XCircle className="w-3 h-3" />
          <span>Rejected</span>
        </span>
      );
    default:
      return (
        <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-full text-xs font-semibold">
          {state}
        </span>
      );
  }
}
