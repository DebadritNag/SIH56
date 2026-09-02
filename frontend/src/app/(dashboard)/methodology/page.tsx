'use client';

import React from 'react';
import { BookOpen, FileText, CheckCircle2, ShieldCheck } from 'lucide-react';

export default function MethodologyPage() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl md:text-2xl font-bold text-[#101828] tracking-tight">
              Statistical Methodology &amp; Laspeyres Formulations
            </h1>
          </div>
          <p className="text-xs text-[#475467] mt-0.5">
            Rigorous mathematical documentation conforming to MoSPI CPI Technical Advisory Committee standards.
          </p>
        </div>
      </div>

      {/* Formulas Documentation */}
      <div className="space-y-4">
        {/* Formula 1 */}
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-5 shadow-xs">
          <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block mb-1">
            Section 1: Daily Matched-Basket Laspeyres Formulation
          </span>
          <h3 className="text-sm font-bold text-[#101828] mb-2">
            APIx Daily Price Index Formula
          </h3>
          <div className="bg-[#F8FAFC] border border-[#E4E7EC] p-4 rounded font-mono text-xs text-[#101828] my-3">
            APIx_t = 100 × [ Σ_(r,b) w_rb × ( P_rbt / P_rb0 ) ] / [ Σ_(r,b) w_rb ]
          </div>
          <p className="text-xs text-[#475467] leading-relaxed">
            Where <em>r</em> represents a directional route corridor (e.g. DEL-BOM), <em>b</em> represents a discrete booking window (T+1, T+7, T+15, T+30, T+45), <em>w_rb</em> represents the fixed base-period passenger traffic expenditure weight derived from DGCA annual digests, <em>P_rbt</em> is the median representative validated fare on day <em>t</em>, and <em>P_rb0</em> is the base reference period fare.
          </p>
        </div>

        {/* Formula 2 */}
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-5 shadow-xs">
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block mb-1">
            Section 2: Statistical Quality Metric
          </span>
          <h3 className="text-sm font-bold text-[#101828] mb-2">
            Trust &amp; Completeness Score Q Formula
          </h3>
          <div className="bg-[#F8FAFC] border border-[#E4E7EC] p-4 rounded font-mono text-xs text-[#101828] my-3">
            Q = 0.40 × C_r + 0.25 × C_s + 0.20 × F + 0.15 × V
          </div>
          <ul className="text-xs text-[#475467] space-y-1 list-disc list-inside leading-relaxed">
            <li><strong>C_r (40% Weight):</strong> Route coverage completeness percentage across all 81 national basket corridors.</li>
            <li><strong>C_s (25% Weight):</strong> Multi-source agreement and cross-channel price convergence rate within 5.0%.</li>
            <li><strong>F (20% Weight):</strong> Temporal collection freshness index (&lt; 3h schedule execution).</li>
            <li><strong>V (15% Weight):</strong> Quote validation pass rate against domain physical sanity bounds.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
