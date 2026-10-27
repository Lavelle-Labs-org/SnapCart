"use client";

import React from "react";
import Image from "next/image";

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
    sm: { w: 24, h: 24 },
    md: { w: 32, h: 32 },
    lg: { w: 40, h: 40 },
    xl: { w: 56, h: 56 },
  };
  const { w, h } = dimMap[size] || dimMap.md;

  return (
    <div className={`relative inline-flex items-center justify-center flex-shrink-0 ${className}`}>
      {/* Light Mode Cart Icon */}
      <Image
        src="/snapcart-icon.png"
        alt="Snapcart"
        width={w}
        height={h}
        className="dark:hidden object-contain"
        priority
      />
      {/* Dark Mode Cart Icon (emerald body with light-slate wheels, zero background fringe) */}
      <Image
        src="/snapcart-icon-dark.png"
        alt="Snapcart"
        width={w}
        height={h}
        className="hidden dark:block object-contain"
        priority
      />
    </div>
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
      sm: "text-lg",
      md: "text-xl",
      lg: "text-2xl",
      xl: "text-3xl",
    };
    const textSize = textSizes[size] || textSizes.md;

    return (
      <div className={`inline-flex items-center gap-2.5 ${className}`}>
        <SnapcartIcon size={size} />
        <span className={`font-bold tracking-tight ${textSize} leading-none select-none`}>
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
