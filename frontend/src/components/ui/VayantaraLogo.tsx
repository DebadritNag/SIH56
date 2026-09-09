"use client";

import React from "react";
import { clsx } from "clsx";

interface VayantaraLogoProps {
  variant?: "standard" | "emblem";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  withWordmark?: boolean;
  subtitle?: string;
  className?: string;
}

export const VayantaraLogo: React.FC<VayantaraLogoProps> = ({
  variant = "standard",
  size = "sm",
  withWordmark = false,
  subtitle,
  className,
}) => {
  const sizeMap = {
    xs: { icon: "w-6 h-6", text: "text-sm", sub: "text-[9px]" },
    sm: { icon: "w-10 h-10", text: "text-xl sm:text-2xl", sub: "text-[10px]" },
    md: { icon: "w-12 h-12", text: "text-2xl", sub: "text-xs" },
    lg: { icon: "w-24 h-24", text: "text-4xl sm:text-5xl lg:text-6xl", sub: "text-sm sm:text-base" },
    xl: { icon: "w-32 h-32", text: "text-5xl sm:text-6xl lg:text-7xl", sub: "text-base" },
  };

  const dim = sizeMap[size];

  if (variant === "emblem") {
    return (
      <div className={clsx("flex flex-col items-center justify-center", className)}>
        <div className={clsx("relative flex items-center justify-center group cursor-pointer", dim.icon)}>
          <svg
            className="w-full h-full drop-shadow-[0_0_24px_rgba(0,210,255,0.45)] transition-transform duration-300 group-hover:scale-105"
            fill="none"
            viewBox="0 0 100 100"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="VAYANTARA Emblem"
          >
            {/* V Shape */}
            <path
              d="M16 22L44 80H56L84 22H68L50 62L32 22H16Z"
              fill="url(#heroVGrad)"
            />
            {/* Connected Data Nodes */}
            <circle cx="58" cy="24" fill="#00D2FF" r="5" />
            <circle cx="74" cy="18" fill="#38BDF8" r="6" />
            <path
              d="M50 62L68 20"
              stroke="#00D2FF"
              strokeDasharray="3 3"
              strokeWidth="2.5"
            />
            {/* Growth Chart Bars */}
            <rect fill="#38BDF8" height="28" rx="2.5" width="5" x="68" y="52" />
            <rect fill="#00D2FF" height="40" rx="2.5" width="5" x="76" y="40" />
            <rect fill="#F59E0B" height="52" rx="2.5" width="5" x="84" y="28" />
            <defs>
              <linearGradient
                gradientUnits="userSpaceOnUse"
                id="heroVGrad"
                x1="16"
                x2="84"
                y1="22"
                y2="80"
              >
                <stop stopColor="#1E40AF" />
                <stop offset="0.5" stopColor="#0284C7" />
                <stop offset="1" stopColor="#00D2FF" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {withWordmark && (
          <div className="mt-4 text-center">
            <h1 className={clsx("font-black tracking-[0.24em] font-display text-white text-glow", dim.text)}>
              VAYANTARA
            </h1>
            {subtitle && (
              <p className={clsx("font-semibold text-slate-200 tracking-wide mt-2", dim.sub)}>
                {subtitle}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // Standard Dynamic V Wing (Navbar & Sidebar)
  return (
    <div className={clsx("flex items-center gap-3 group", className)}>
      <div className={clsx("relative flex items-center justify-center shrink-0", dim.icon)}>
        <svg
          className="w-full h-full transform transition duration-200 group-hover:scale-105"
          fill="none"
          viewBox="0 0 48 48"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="VAYANTARA Logo"
        >
          {/* Dynamic V Wing */}
          <path
            className="drop-shadow-[0_0_8px_rgba(0,210,255,0.7)]"
            d="M6 10L19 38H27L42 10"
            stroke="#00D2FF"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3.5"
          />
          <path
            d="M15 14L23 32L31 14"
            opacity="0.8"
            stroke="#ffffff"
            strokeLinecap="round"
            strokeWidth="2.5"
          />
          {/* Chart / Signal bars */}
          <path d="M34 26V34" stroke="#38BDF8" strokeLinecap="round" strokeWidth="3" />
          <path d="M39 20V34" stroke="#00D2FF" strokeLinecap="round" strokeWidth="3" />
          <path d="M44 14V34" stroke="#F59E0B" strokeLinecap="round" strokeWidth="3" />
          {/* Connecting Dots */}
          <circle cx="27" cy="11" fill="#38BDF8" r="2.5" />
          <circle className="animate-pulse" cx="37" cy="8" fill="#00D2FF" r="3" />
        </svg>
      </div>

      {withWordmark && (
        <div className="flex flex-col overflow-hidden">
          <span className={clsx("font-bold tracking-[0.18em] text-white font-display uppercase truncate", dim.text)}>
            VAYANTARA
          </span>
          {subtitle && (
            <span className={clsx("text-slate-400 font-medium truncate uppercase tracking-wider", dim.sub)}>
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
