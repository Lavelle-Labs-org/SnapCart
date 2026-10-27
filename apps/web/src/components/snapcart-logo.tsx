"use client";

import React from "react";
import { SNAPCART_BODY_PATH, SNAPCART_WHEELS_PATH } from "./snapcart-svg-paths";

export interface SnapcartLogoProps {
  /**
   * "horizontal" = Icon + "Snapcart" wordmark side by side (ideal for navbar)
   * "stacked" = Icon above "Snapcart" wordmark + optional tagline (ideal for auth cards and footers)
   * "icon" = Cart with speed streaks only (ideal for badges, mobile sidebars)
   */
  variant?: "horizontal" | "stacked" | "icon";
  size?: "sm" | "md" | "lg" | "xl";
  showTagline?: boolean;
  className?: string;
}

export function SnapcartIcon({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const dimMap = {
    sm: { w: 36, h: 21 },
    md: { w: 50, h: 30 },
    lg: { w: 66, h: 39 },
    xl: { w: 86, h: 51 },
  };
  const { w, h } = dimMap[size] || dimMap.md;

  return (
    <svg
      viewBox="0 0 320 190"
      width={w}
      height={h}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block flex-shrink-0 transition-colors duration-200 ${className}`}
      aria-label="Snapcart Logo"
    >
      <path
        d={SNAPCART_BODY_PATH}
        fillRule="evenodd"
        className="fill-[#00976f] dark:fill-[#10b981] transition-colors duration-200"
      />
      <path
        d={SNAPCART_WHEELS_PATH}
        fillRule="evenodd"
        className="fill-[#18262f] dark:fill-[#f8fafc] transition-colors duration-200"
      />
    </svg>
  );
}

export function SnapcartLogo({
  variant = "horizontal",
  size = "md",
  showTagline = false,
  className = "",
}: SnapcartLogoProps) {
  if (variant === "icon") {
    return <SnapcartIcon size={size} className={className} />;
  }

  if (variant === "horizontal") {
    const textSizes = {
      sm: "text-lg font-bold",
      md: "text-xl sm:text-2xl font-extrabold",
      lg: "text-2xl sm:text-3xl font-extrabold",
      xl: "text-3xl sm:text-4xl font-black",
    };
    const textSize = textSizes[size] || textSizes.md;

    return (
      <div className={`inline-flex items-center gap-2.5 sm:gap-3 ${className}`}>
        <SnapcartIcon size={size} />
        <span className={`tracking-tight ${textSize} leading-none select-none`}>
          <span className="text-[#00976f] dark:text-[#10b981]">Snap</span>
          <span className="text-[#18262f] dark:text-slate-100">cart</span>
        </span>
      </div>
    );
  }

  // Stacked variant (icon + wordmark + optional tagline)
  const textSizes = {
    sm: "text-xl",
    md: "text-2xl sm:text-3xl",
    lg: "text-3xl sm:text-4xl",
    xl: "text-4xl sm:text-5xl",
  };
  const textSize = textSizes[size] || textSizes.md;

  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      <div className="relative mb-2.5">
        <SnapcartIcon size={size === "sm" ? "md" : size === "md" ? "lg" : "xl"} />
      </div>
      <div className={`font-bold tracking-tight ${textSize} leading-none select-none`}>
        <span className="text-[#00976f] dark:text-[#10b981]">Snap</span>
        <span className="text-[#18262f] dark:text-slate-100">cart</span>
      </div>
      {showTagline && (
        <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 font-medium tracking-normal">
          Order in a snap.
        </span>
      )}
    </div>
  );
}
