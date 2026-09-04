'use client';

import React from 'react';
import { clsx } from 'clsx';
import { Radio } from 'lucide-react';

interface CircleReloadingAnimationProps {
  title?: string;
  subtitle?: string;
  badge?: string;
  size?: 'sm' | 'md' | 'lg' | 'overlay';
  minHeight?: string;
  className?: string;
}

export const CircleReloadingAnimation: React.FC<CircleReloadingAnimationProps> = ({
  title = 'Loading Live Intelligence...',
  subtitle = 'Connecting to real-time aviation telemetry and verifying cryptographic signatures...',
  badge = 'LIVE SYNC',
  size = 'md',
  minHeight = 'min-h-[280px]',
  className,
}) => {
  const isOverlay = size === 'overlay';
  const isSm = size === 'sm';
  const isLg = size === 'lg' || isOverlay;

  const circleDimensions = isSm
    ? { outer: 'w-10 h-10', svg: 'w-8 h-8', dot: 'w-2 h-2', stroke: '3' }
    : isLg
    ? { outer: 'w-20 h-20', svg: 'w-16 h-16', dot: 'w-3.5 h-3.5', stroke: '4' }
    : { outer: 'w-14 h-14', svg: 'w-12 h-12', dot: 'w-2.5 h-2.5', stroke: '3.5' };

  const content = (
    <div className={clsx('flex flex-col items-center justify-center text-center p-6 select-none', className)}>
      {/* Animated Circular Loader */}
      <div className="relative flex items-center justify-center mb-4">
        {/* Ambient Expanding Wave Ring */}
        <div
          className={clsx(
            'absolute rounded-full border border-blue-400/40 animate-ping',
            circleDimensions.outer
          )}
          style={{ animationDuration: '2.4s' }}
        />

        {/* Secondary Soft Glow Circle */}
        <div
          className={clsx(
            'absolute rounded-full bg-blue-500/10 animate-pulse',
            circleDimensions.outer
          )}
        />

        {/* Crisp Vector Circular Spinner with Dash Offsets */}
        <svg
          className={clsx('animate-spin text-blue-600 drop-shadow-xs', circleDimensions.svg)}
          viewBox="0 0 50 50"
          style={{ animationDuration: '1.1s' }}
        >
          {/* Subtle Background Track */}
          <circle
            className="text-slate-200"
            strokeWidth={circleDimensions.stroke}
            stroke="currentColor"
            fill="transparent"
            r="20"
            cx="25"
            cy="25"
          />
          {/* Active Spinning Arc with Rounded Cap */}
          <circle
            className="text-blue-600"
            strokeWidth={circleDimensions.stroke}
            strokeDasharray="80, 160"
            strokeDashoffset="0"
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
            r="20"
            cx="25"
            cy="25"
          />
          {/* Secondary Counter-Arc */}
          <circle
            className="text-indigo-400/70"
            strokeWidth={circleDimensions.stroke}
            strokeDasharray="25, 180"
            strokeDashoffset="-90"
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
            r="20"
            cx="25"
            cy="25"
          />
        </svg>

        {/* Center Live Radar Dot */}
        <div
          className={clsx(
            'absolute bg-gradient-to-tr from-blue-700 to-indigo-500 rounded-full shadow-xs animate-pulse',
            circleDimensions.dot
          )}
        />
      </div>

      {/* Badge */}
      {badge && (
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 mb-2 rounded-full bg-blue-50 border border-blue-200/80 text-[10px] font-bold text-blue-800 uppercase tracking-wider shadow-2xs">
          <Radio className="w-2.5 h-2.5 text-blue-600 animate-pulse" />
          <span>{badge}</span>
        </div>
      )}

      {/* Title */}
      <h4 className={clsx('font-bold text-[#101828] tracking-tight', isSm ? 'text-xs' : 'text-sm')}>
        {title}
      </h4>

      {/* Subtitle */}
      {subtitle && (
        <p className={clsx('text-[#667085] mt-1 max-w-sm leading-relaxed', isSm ? 'text-[11px]' : 'text-xs')}>
          {subtitle}
        </p>
      )}
    </div>
  );

  if (isOverlay) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-xs flex items-center justify-center animate-in fade-in duration-200">
        <div className="bg-white border border-[#E4E7EC] rounded-xl shadow-2xl p-6 max-w-sm mx-4">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'w-full bg-white border border-[#E4E7EC] rounded-lg shadow-xs flex items-center justify-center',
        minHeight
      )}
    >
      {content}
    </div>
  );
};
