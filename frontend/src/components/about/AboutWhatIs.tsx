import React from "react";
import { ArrowRight, Globe, Layers, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";

export function AboutWhatIs() {
  return (
    <section className="py-20 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          {/* Left Side: Conceptual Narrative & Feature Grid */}
          <div className="lg:col-span-6 flex flex-col justify-between">
            <div>
              <span className="text-xs uppercase tracking-[0.25em] font-bold text-sky-600 block mb-3">
                What VAYANTARA Is
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight mb-5">
                A public-data intelligence platform for{" "}
                <span className="text-[#0284c7]">airfare price index</span> measurement in India.
              </h2>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed mb-10">
                VAYANTARA collects domestic airfare data from multiple online sources and airline data, preserves cryptographic provenance, and computes a transparent, high-frequency Airfare Price Index (APIx) using robust statistical methods and explainable AI.
              </p>
            </div>

            {/* 4 Card Icons Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
              {/* Box 1 */}
              <div className="p-3.5 rounded-lg bg-sky-50/70 border border-sky-100/80 text-center flex flex-col items-center">
                <div className="w-9 h-9 rounded-md bg-white shadow-sm flex items-center justify-center text-sky-600 mb-2 border border-sky-100">
                  <Layers className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-slate-800 leading-snug">
                  Multi-source data ingestion
                </span>
              </div>

              {/* Box 2 */}
              <div className="p-3.5 rounded-lg bg-sky-50/70 border border-sky-100/80 text-center flex flex-col items-center">
                <div className="w-9 h-9 rounded-md bg-white shadow-sm flex items-center justify-center text-sky-600 mb-2 border border-sky-100">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-slate-800 leading-snug">
                  Transparent index methodology
                </span>
              </div>

              {/* Box 3 */}
              <div className="p-3.5 rounded-lg bg-sky-50/70 border border-sky-100/80 text-center flex flex-col items-center">
                <div className="w-9 h-9 rounded-md bg-white shadow-sm flex items-center justify-center text-sky-600 mb-2 border border-sky-100">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-slate-800 leading-snug">
                  Auditable &amp; verifiable pipeline
                </span>
              </div>

              {/* Box 4 */}
              <div className="p-3.5 rounded-lg bg-sky-50/70 border border-sky-100/80 text-center flex flex-col items-center">
                <div className="w-9 h-9 rounded-md bg-white shadow-sm flex items-center justify-center text-sky-600 mb-2 border border-sky-100">
                  <Sparkles className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-slate-800 leading-snug">
                  Explainable AI models
                </span>
              </div>
            </div>
          </div>

          {/* Right Side: 5-Stage Diagram (Data Pipeline Stack) */}
          <div className="lg:col-span-6 bg-slate-50 border border-slate-200/90 rounded-2xl p-6 sm:p-8 flex flex-col justify-center">
            <span className="text-xs uppercase tracking-[0.25em] font-bold text-slate-500 mb-6 block text-center sm:text-left">
              From Data to Economic Insight
            </span>
            <div className="space-y-3.5 relative">
              {/* Layer 1: Multiple Data Sources */}
              <div className="flex items-center gap-3">
                <div className="w-1/2 sm:w-5/12 text-right pr-2">
                  <div className="text-xs font-bold text-slate-800">Multiple Data Sources</div>
                  <div className="text-[11px] text-slate-500">Airlines • OTAs • Public Data</div>
                </div>
                <div className="text-sky-500 shrink-0">
                  <ArrowRight className="w-4 h-4" />
                </div>
                <div className="flex-1 bg-gradient-to-r from-sky-100 to-sky-50 border border-sky-200 rounded-lg p-3 flex items-center justify-around shadow-sm text-sky-800">
                  <svg className="w-4 h-4 text-sky-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4 6H20V8H4zM4 11H20V13H4zM4 16H20V18H4z" />
                  </svg>
                  <svg className="w-4 h-4 text-sky-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
                  </svg>
                  <svg className="w-4 h-4 text-sky-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                  </svg>
                  <Globe className="w-4 h-4 text-sky-600" />
                </div>
              </div>

              {/* Layer 2: Data Validation & Cleaning */}
              <div className="flex items-center gap-3">
                <div className="w-1/2 sm:w-5/12 text-right pr-2">
                  <div className="text-xs font-bold text-slate-800">Data Validation &amp; Cleaning</div>
                  <div className="text-[11px] text-slate-500">Quality checks • De-duplication</div>
                </div>
                <div className="text-sky-500 shrink-0">
                  <ArrowRight className="w-4 h-4" />
                </div>
                <div className="flex-1 bg-gradient-to-r from-sky-100 to-sky-50 border border-sky-200 rounded-lg p-3 flex items-center justify-center shadow-sm">
                  {/* Visual array of filter dots */}
                  <div className="flex gap-1.5 text-sky-500">
                    <span className="w-2 h-2 rounded-full bg-sky-400" />
                    <span className="w-2 h-2 rounded-full bg-sky-500" />
                    <span className="w-2 h-2 rounded-full bg-sky-600" />
                    <span className="w-2 h-2 rounded-full bg-sky-400" />
                    <span className="w-2 h-2 rounded-full bg-sky-300" />
                    <span className="w-2 h-2 rounded-full bg-sky-600" />
                    <span className="w-2 h-2 rounded-full bg-sky-500" />
                  </div>
                </div>
              </div>

              {/* Layer 3: AI & Statistical Models */}
              <div className="flex items-center gap-3">
                <div className="w-1/2 sm:w-5/12 text-right pr-2">
                  <div className="text-xs font-bold text-slate-800">AI &amp; Statistical Models</div>
                  <div className="text-[11px] text-slate-500">Fare normalization • Index computation</div>
                </div>
                <div className="text-sky-500 shrink-0">
                  <ArrowRight className="w-4 h-4" />
                </div>
                <div className="flex-1 bg-gradient-to-r from-sky-100 to-sky-50 border border-sky-200 rounded-lg p-2.5 flex items-center justify-center shadow-sm">
                  <svg className="w-full h-7 text-sky-600" fill="none" viewBox="0 0 160 30">
                    <path d="M0,20 Q 20,5 40,25 T 80,10 T 120,20 T 160,5" stroke="currentColor" strokeWidth="2" />
                    <circle cx="40" cy="25" fill="#0284c7" r="2.5" />
                    <circle cx="80" cy="10" fill="#0284c7" r="2.5" />
                    <circle cx="120" cy="20" fill="#0284c7" r="2.5" />
                  </svg>
                </div>
              </div>

              {/* Layer 4: Airfare Price Index (APIx) */}
              <div className="flex items-center gap-3">
                <div className="w-1/2 sm:w-5/12 text-right pr-2">
                  <div className="text-xs font-bold text-slate-800">Airfare Price Index (APIx)</div>
                  <div className="text-[11px] text-slate-500">High-frequency • Transparent</div>
                </div>
                <div className="text-sky-500 shrink-0">
                  <ArrowRight className="w-4 h-4" />
                </div>
                <div className="flex-1 bg-gradient-to-r from-sky-200 to-sky-100 border border-sky-300 rounded-lg p-2.5 flex items-center justify-center gap-1.5 shadow-sm">
                  <div className="w-2.5 h-3.5 bg-sky-700 rounded-sm" />
                  <div className="w-2.5 h-5 bg-sky-700 rounded-sm" />
                  <div className="w-2.5 h-4 bg-sky-700 rounded-sm" />
                  <div className="w-2.5 h-6 bg-sky-700 rounded-sm" />
                  <div className="w-2.5 h-5 bg-sky-700 rounded-sm" />
                  <div className="w-2.5 h-7 bg-sky-800 rounded-sm" />
                </div>
              </div>

              {/* Layer 5: Economic Insights */}
              <div className="flex items-center gap-3">
                <div className="w-1/2 sm:w-5/12 text-right pr-2">
                  <div className="text-xs font-bold text-slate-800">Economic Insights</div>
                  <div className="text-[11px] text-slate-500">Policy • Research • Planning</div>
                </div>
                <div className="text-sky-500 shrink-0">
                  <ArrowRight className="w-4 h-4" />
                </div>
                <div className="flex-1 bg-gradient-to-r from-sky-700 to-sky-800 text-white rounded-lg p-2.5 flex items-center justify-between px-4 shadow-sm">
                  <span className="text-[11px] font-semibold tracking-wide flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-cyan-300" />
                    Macro Impact
                  </span>
                  <TrendingUp className="w-4 h-4 text-cyan-300" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
