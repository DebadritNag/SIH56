'use client';

import React from 'react';
import { clsx } from 'clsx';

export interface AirPulseFlightLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  showLabel?: boolean;
  variant?: 'inline' | 'overlay' | 'panel';
  route?: string;
  source?: string;
  window?: string;
  sublabel?: string;
  badge?: string;
  minHeight?: string;
  className?: string;
  theme?: 'auto' | 'dark' | 'light';
}

/**
 * AirPulseFlightLoader
 *
 * Premium aviation-themed loader featuring:
 * - 5 progressive circular dots along a curved upward flight path (Bezier curve)
 * - Sleek commercial airliner silhouette oriented along the trajectory
 * - Smooth sequential dot illumination and subtle aerodynamic plane glide
 * - Scoped pure SVG + CSS animation (zero heavy libraries or GIFs)
 * - Accessible with role="status", aria-live="polite", and prefers-reduced-motion fallback
 */
export const AirPulseFlightLoader: React.FC<AirPulseFlightLoaderProps> = ({
  size = 'md',
  label = 'Collecting live fares...',
  showLabel = true,
  variant = 'inline',
  route,
  source,
  window: bookingWindow,
  sublabel,
  badge,
  minHeight,
  className,
  theme = 'auto',
}) => {
  // Dimensions and scaling based on size
  const config = {
    sm: {
      viewBox: '0 0 160 52',
      width: 110,
      height: 36,
      dotRadius: 2.2,
      planeScale: 0.78,
      textSize: 'text-xs',
      subtextSize: 'text-[10px]',
      badgeSize: 'text-[9px] px-1.5 py-0.5',
    },
    md: {
      viewBox: '0 0 160 52',
      width: 154,
      height: 50,
      dotRadius: 2.8,
      planeScale: 1.0,
      textSize: 'text-sm',
      subtextSize: 'text-[11px]',
      badgeSize: 'text-[10px] px-2 py-0.5',
    },
    lg: {
      viewBox: '0 0 160 52',
      width: 200,
      height: 65,
      dotRadius: 3.4,
      planeScale: 1.22,
      textSize: 'text-base',
      subtextSize: 'text-xs',
      badgeSize: 'text-[11px] px-2.5 py-0.5',
    },
  }[size];

  const hasContextBadge = Boolean(route || source || bookingWindow);

  // Formatted flight context tags
  const flightContext = (
    <div
      className={clsx(
        'inline-flex items-center gap-1.5 font-mono rounded border',
        config.badgeSize,
        theme === 'dark'
          ? 'bg-white/5 border-white/10 text-slate-300'
          : theme === 'light'
          ? 'bg-slate-100 border-slate-200 text-slate-700'
          : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
      )}
    >
      {route && <span className="font-semibold text-sky-600 dark:text-sky-400">{route}</span>}
      {route && (source || bookingWindow) && <span className="opacity-40">·</span>}
      {source && <span>{source}</span>}
      {source && bookingWindow && <span className="opacity-40">·</span>}
      {bookingWindow && <span className="text-slate-500 dark:text-slate-400">{bookingWindow}</span>}
    </div>
  );

  // Core SVG Animation
  const loaderGraphic = (
    <div className="relative inline-flex items-center justify-center select-none" aria-hidden="true">
      <svg
        viewBox={config.viewBox}
        width={config.width}
        height={config.height}
        className="overflow-visible"
      >
        <defs>
          <style>{`
            @keyframes ap-dot-sweep {
              0%, 100% {
                opacity: 0.22;
                transform: scale(0.85);
              }
              22%, 62% {
                opacity: 1;
                transform: scale(1.28);
              }
              78% {
                opacity: 0.42;
                transform: scale(0.95);
              }
            }

            @keyframes ap-plane-flight {
              0%, 100% {
                transform: translate(0px, 0px) rotate(-18deg);
              }
              28% {
                transform: translate(2.5px, -1.5px) rotate(-15deg);
              }
              58% {
                transform: translate(5px, -3.2px) rotate(-20deg);
              }
              78% {
                transform: translate(6px, -4px) rotate(-16deg);
              }
            }

            .ap-fl-dot {
              transform-box: fill-box;
              transform-origin: center;
              animation: ap-dot-sweep 2.2s infinite ease-in-out;
            }

            .ap-fl-d1 { animation-delay: 0.0s; }
            .ap-fl-d2 { animation-delay: 0.22s; }
            .ap-fl-d3 { animation-delay: 0.44s; }
            .ap-fl-d4 { animation-delay: 0.66s; }
            .ap-fl-d5 { animation-delay: 0.88s; }

            .ap-fl-plane {
              transform-box: fill-box;
              transform-origin: center;
              animation: ap-plane-flight 2.2s infinite ease-in-out;
            }

            @media (prefers-reduced-motion: reduce) {
              .ap-fl-dot, .ap-fl-plane {
                animation: none !important;
                opacity: 0.85 !important;
                transform: none !important;
              }
            }
          `}</style>

          <filter id="ap-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#38BDF8" floodOpacity="0.75" />
          </filter>
        </defs>

        {/* Faint dashed flight route guide line */}
        <path
          d="M 16 38 C 50 36, 92 27, 134 14"
          fill="none"
          stroke="currentColor"
          strokeDasharray="2 3"
          strokeWidth="1.2"
          className={clsx(
            theme === 'dark'
              ? 'text-sky-400 opacity-20'
              : theme === 'light'
              ? 'text-sky-600 opacity-25'
              : 'text-sky-600 dark:text-sky-400 opacity-25 dark:opacity-20'
          )}
        />

        {/* 5 Sequential Route Dots */}
        <circle
          cx="16"
          cy="38"
          r={config.dotRadius}
          className={clsx(
            'ap-fl-dot ap-fl-d1',
            theme === 'dark'
              ? 'fill-sky-400'
              : theme === 'light'
              ? 'fill-sky-600'
              : 'fill-sky-600 dark:fill-sky-400'
          )}
        />
        <circle
          cx="45"
          cy="34"
          r={config.dotRadius}
          className={clsx(
            'ap-fl-dot ap-fl-d2',
            theme === 'dark'
              ? 'fill-sky-400'
              : theme === 'light'
              ? 'fill-sky-600'
              : 'fill-sky-600 dark:fill-sky-400'
          )}
        />
        <circle
          cx="74"
          cy="27.5"
          r={config.dotRadius}
          className={clsx(
            'ap-fl-dot ap-fl-d3',
            theme === 'dark'
              ? 'fill-sky-400'
              : theme === 'light'
              ? 'fill-sky-600'
              : 'fill-sky-600 dark:fill-sky-400'
          )}
        />
        <circle
          cx="104"
          cy="19.5"
          r={config.dotRadius}
          className={clsx(
            'ap-fl-dot ap-fl-d4',
            theme === 'dark'
              ? 'fill-sky-400'
              : theme === 'light'
              ? 'fill-sky-600'
              : 'fill-sky-600 dark:fill-sky-400'
          )}
        />
        <circle
          cx="132"
          cy="13"
          r={config.dotRadius}
          className={clsx(
            'ap-fl-dot ap-fl-d5',
            theme === 'dark'
              ? 'fill-sky-400'
              : theme === 'light'
              ? 'fill-sky-600'
              : 'fill-sky-600 dark:fill-sky-400'
          )}
        />

        {/* Aerodynamic Commercial Airliner Silhouette */}
        <g transform={`translate(145, 9.5) scale(${config.planeScale})`}>
          <g className="ap-fl-plane">
            <path
              d="M9 0C8.5 -0.8 6 -1.2 2 -1.2L-2 -11C-2.4 -11.8 -3.2 -11.8 -3.5 -11L-3.5 -1.2L-6.5 -1.2L-8 -4.5C-8.3 -4.9 -8.8 -4.9 -9 -4.5L-8.8 0L-9 4.5C-8.8 4.9 -8.3 4.9 -8 4.5L-6.5 1.2L-3.5 1.2L-3.5 11C-3.2 11.8 -2.4 11.8 -2 11L2 1.2C6 1.2 8.5 0.8 9 0Z"
              className={clsx(
                theme === 'dark'
                  ? 'fill-sky-400'
                  : theme === 'light'
                  ? 'fill-sky-600'
                  : 'fill-sky-600 dark:fill-sky-400'
              )}
              filter="url(#ap-glow)"
            />
          </g>
        </g>
      </svg>
    </div>
  );

  // Content block containing graphic + typography
  const content = (
    <div
      role="status"
      aria-live="polite"
      className={clsx(
        'flex flex-col items-center justify-center text-center',
        variant === 'inline' ? 'p-2' : 'p-6',
        className
      )}
    >
      {/* Visual Flight Graphic */}
      {loaderGraphic}

      {/* Screen reader fallback */}
      <span className="sr-only">{label}</span>

      {/* Optional Badge */}
      {badge && (
        <span
          className={clsx(
            'inline-block mt-3 uppercase tracking-wider font-bold rounded-full',
            config.badgeSize,
            theme === 'dark'
              ? 'bg-sky-500/10 text-sky-300 border border-sky-400/20'
              : theme === 'light'
              ? 'bg-sky-50 text-sky-700 border border-sky-200'
              : 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-400/20'
          )}
        >
          {badge}
        </span>
      )}

      {/* Primary Label */}
      {showLabel && label && (
        <h4
          className={clsx(
            'font-bold tracking-tight',
            config.textSize,
            badge ? 'mt-1.5' : 'mt-3',
            theme === 'dark'
              ? 'text-white'
              : theme === 'light'
              ? 'text-slate-900'
              : 'text-slate-900 dark:text-white'
          )}
        >
          {label}
        </h4>
      )}

      {/* Live Route Context Badge */}
      {hasContextBadge && <div className="mt-2">{flightContext}</div>}

      {/* Optional Sublabel / Stage Diagnostic */}
      {sublabel && (
        <p
          className={clsx(
            'mt-1.5 max-w-sm leading-relaxed font-mono',
            config.subtextSize,
            theme === 'dark'
              ? 'text-slate-400'
              : theme === 'light'
              ? 'text-slate-500'
              : 'text-slate-500 dark:text-slate-400'
          )}
        >
          {sublabel}
        </p>
      )}
    </div>
  );

  // Variant: Full or Container Overlay
  if (variant === 'overlay') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
        <div
          className={clsx(
            'w-full max-w-sm rounded-xl p-6 shadow-2xl border',
            theme === 'dark'
              ? 'bg-[#0A1428] border-white/10'
              : theme === 'light'
              ? 'bg-white border-slate-200'
              : 'bg-white dark:bg-[#0A1428] border-slate-200 dark:border-white/10'
          )}
        >
          {content}
        </div>
      </div>
    );
  }

  // Variant: Panel (Card container)
  if (variant === 'panel') {
    return (
      <div
        className={clsx(
          'w-full rounded-lg shadow-xs flex items-center justify-center border',
          minHeight || (size === 'lg' ? 'min-h-[320px]' : 'min-h-[220px]'),
          theme === 'dark'
            ? 'bg-[#0A1428] border-white/10 text-white'
            : theme === 'light'
            ? 'bg-white border-[#E4E7EC] text-slate-900'
            : 'bg-white dark:bg-[#0A1428] border-[#E4E7EC] dark:border-white/10 text-slate-900 dark:text-white'
        )}
      >
        {content}
      </div>
    );
  }

  // Variant: Inline (Transparent wrapper)
  return content;
};
