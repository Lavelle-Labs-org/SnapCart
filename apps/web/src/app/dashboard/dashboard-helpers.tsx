import React from "react";
import { CheckCircle, Clock, XCircle, PackageCheck } from "lucide-react";

export interface OrdersDashboardPageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

import { jwtVerify } from "jose";

function getSessionSecretKey(secret?: string): Uint8Array {
  const secretStr =
    secret ||
    process.env.SESSION_SECRET ||
    "mock_session_secret_at_least_32_characters_long";
  return new TextEncoder().encode(secretStr);
}

/**
 * Extracts sellerId from JWT token payload after cryptographically verifying
 * the HMAC-SHA256 signature against SESSION_SECRET.
 * Returns null if signature is invalid, token is expired, or sellerId is empty.
 */
export async function extractSellerIdFromToken(
  token: string,
  secret?: string
): Promise<string | null> {
  if (!token || typeof token !== "string" || token.trim() === "") {
    return null;
  }
  try {
    const secretKey = getSessionSecretKey(secret);
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });
    if (
      payload &&
      typeof payload.sellerId === "string" &&
      payload.sellerId.trim() !== ""
    ) {
      return payload.sellerId.trim();
    }
  } catch {
    // Return null on invalid signature, expired token, or malformed JWT
  }
  return null;
}

/**
 * Formats relative timestamp or date string for human readability in order queue.
 */
export function formatOrderTime(dateInput: Date | string, isAmharic = false): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (!date || isNaN(date.getTime())) return isAmharic ? "በቅርቡ" : "Recently";

  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return isAmharic ? "አሁን" : "Just now";
  if (diffMins === 1) return isAmharic ? "ከ1 ደቂቃ በፊት" : "1 min ago";
  if (diffMins < 60) return isAmharic ? `ከ${diffMins} ደቂቃ በፊት` : `${diffMins} mins ago`;
  if (diffHours === 1) return isAmharic ? "ከ1 ሰዓት በፊት" : "1 hour ago";
  if (diffHours < 24) return isAmharic ? `ከ${diffHours} ሰዓት በፊት` : `${diffHours} hours ago`;
  if (diffDays === 1) return isAmharic ? "ትናንት" : "Yesterday";
  return date.toLocaleDateString(isAmharic ? "am-ET" : "en-US", { month: "short", day: "numeric" });
}

/**
 * Renders state badge with distinct color and semantic status indicator.
 */
export function getStatusBadge(state: string, isAmharic = false) {
  switch (state) {
    case "new":
      return (
        <span className="px-2.5 py-1 bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 dark:border dark:border-amber-900/60 rounded-full text-xs font-semibold inline-flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{isAmharic ? "አዲስ" : "New"}</span>
        </span>
      );
    case "accepted":
      return (
        <span className="px-2.5 py-1 bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 dark:border dark:border-blue-900/60 rounded-full text-xs font-semibold inline-flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          <span>{isAmharic ? "ተቀባይነት አግኝቷል" : "Accepted"}</span>
        </span>
      );
    case "ready":
      return (
        <span className="px-2.5 py-1 bg-teal-50 text-teal-800 border border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800 rounded-full text-xs font-semibold inline-flex items-center gap-1">
          <PackageCheck className="w-3 h-3" />
          <span>{isAmharic ? "ዝግጁ" : "Ready"}</span>
        </span>
      );
    case "completed":
      return (
        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border dark:border-emerald-900/60 rounded-full text-xs font-semibold inline-flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          <span>{isAmharic ? "ተጠናቋል" : "Completed"}</span>
        </span>
      );
    case "rejected":
      return (
        <span className="px-2.5 py-1 bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 dark:border dark:border-rose-900/60 rounded-full text-xs font-semibold inline-flex items-center gap-1">
          <XCircle className="w-3 h-3" />
          <span>{isAmharic ? "አልተቀበለም" : "Rejected"}</span>
        </span>
      );
    default:
      return (
        <span className="px-2.5 py-1 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:border dark:border-slate-700 rounded-full text-xs font-semibold">
          {state}
        </span>
      );
  }
}
