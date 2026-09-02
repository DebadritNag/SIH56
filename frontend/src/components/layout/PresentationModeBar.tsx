'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { Presentation, ArrowRight, CheckCircle, X } from 'lucide-react';

interface PresentationModeBarProps {
  onClose: () => void;
}

const DEMO_STEPS = [
  { step: 1, label: 'National APIx Overview', href: '/overview', desc: 'Airfare inflation & national pressure' },
  { step: 2, label: 'Data Ingestion Console', href: '/ingestion', desc: 'Batch collection pipeline & runs' },
  { step: 3, label: 'Live Web Scraping Test', href: '/scraping-test', desc: 'Real-time controlled web extraction' },
  { step: 4, label: 'Route Intelligence', href: '/routes', desc: 'DEL-BOM advance purchase & curve' },
  { step: 5, label: 'Anomaly & SHAP Analysis', href: '/anomalies', desc: 'Explainable AI & multi-source check' },
  { step: 6, label: 'System Diagnostics & Audit', href: '/system', desc: '12-point self-test & reliability' },
];

export const PresentationModeBar: React.FC<PresentationModeBarProps> = ({ onClose }) => {
  const pathname = usePathname();

  return (
    <div className="bg-[#081426] text-white border-b border-amber-500/40 px-6 py-2.5 flex items-center justify-between shadow-md z-30 sticky top-[60px]">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500 text-black font-bold text-[10px] rounded uppercase tracking-wider">
          <Presentation className="w-3.5 h-3.5" />
          <span>SIH Judge Demo Walkthrough</span>
        </div>
        <span className="text-xs text-[#94A3B8] hidden xl:inline">
          Use this guided sequential tour to demonstrate end-to-end capabilities without hunting through menus:
        </span>
      </div>

      {/* Steps list */}
      <div className="flex items-center gap-1.5">
        {DEMO_STEPS.map((s, idx) => {
          const isActive = pathname === s.href;
          return (
            <React.Fragment key={s.step}>
              <Link
                href={s.href}
                className={clsx(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-all',
                  isActive
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'text-[#94A3B8] hover:text-white hover:bg-slate-800/80 font-medium'
                )}
              >
                <span className={clsx(
                  'w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono',
                  isActive ? 'bg-white text-blue-600' : 'bg-slate-700 text-slate-300'
                )}>
                  {s.step}
                </span>
                <span className="hidden md:inline">{s.label}</span>
              </Link>
              {idx < DEMO_STEPS.length - 1 && (
                <ArrowRight className="w-3 h-3 text-[#475467] hidden lg:inline" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <button
        onClick={onClose}
        className="p-1 rounded text-[#94A3B8] hover:text-white hover:bg-slate-800 transition-colors ml-3"
        title="Exit Presentation Mode"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
