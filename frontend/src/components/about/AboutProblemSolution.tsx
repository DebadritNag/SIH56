import React from "react";
import { ArrowRight, X } from "lucide-react";

export function AboutProblemSolution() {
  return (
    <section className="py-20 bg-white border-b border-slate-200 text-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left: Problem Header & Subtitle */}
          <div className="lg:col-span-5 space-y-4">
            <span className="text-xs uppercase tracking-[0.25em] font-bold text-sky-600 block">
              The Problem Being Solved
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Fragmented data. No transparency. Limited visibility.
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              Airfare data is scattered across multiple platforms, often not standardized, and rarely used in official economic measurement. This leads to gaps in real-time monitoring, weak price intelligence, and missed opportunities for data-driven policy making.
            </p>
          </div>

          {/* Right: Problem Points to Solution Card Flow */}
          <div className="lg:col-span-7">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* 3 Red Issue Cards */}
              <div className="space-y-3 w-full sm:w-7/12">
                <div className="flex items-center gap-3 p-3.5 bg-rose-50/70 border border-rose-100 rounded-xl">
                  <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center shrink-0">
                    <X className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                  <span className="text-xs font-semibold text-slate-800">
                    Fragmented and inconsistent data sources
                  </span>
                </div>

                <div className="flex items-center gap-3 p-3.5 bg-rose-50/70 border border-rose-100 rounded-xl">
                  <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center shrink-0">
                    <X className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                  <span className="text-xs font-semibold text-slate-800">
                    Lack of transparent and auditable methodology
                  </span>
                </div>

                <div className="flex items-center gap-3 p-3.5 bg-rose-50/70 border border-rose-100 rounded-xl">
                  <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center shrink-0">
                    <X className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                  <span className="text-xs font-semibold text-slate-800">
                    No real-time indicator for airfare price movement
                  </span>
                </div>
              </div>

              {/* Transition Arrow */}
              <div className="text-sky-500 shrink-0 rotate-90 sm:rotate-0">
                <ArrowRight className="w-6 h-6 stroke-[2.5]" />
              </div>

              {/* Resolution Card */}
              <div className="w-full sm:w-5/12 bg-gradient-to-br from-[#0284c7] to-[#0369a1] text-white p-6 rounded-2xl shadow-lg text-center flex flex-col items-center justify-center">
                <div className="w-10 h-10 mb-3 text-cyan-200">
                  <svg className="w-full h-full" fill="currentColor" viewBox="0 0 36 36">
                    <path d="M6 18L18 6L30 18L18 30L6 18Z" opacity="0.4" />
                    <path d="M12 18L18 12L24 18L18 24L12 18Z" fill="#ffffff" />
                  </svg>
                </div>
                <span className="text-sm font-extrabold uppercase tracking-widest block mb-1">
                  VAYANTARA
                </span>
                <p className="text-xs text-sky-100 leading-snug">
                  Brings clarity, structure and intelligence.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
