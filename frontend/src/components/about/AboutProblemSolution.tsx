import React from "react";
import Image from "next/image";
import { ArrowRight, X } from "lucide-react";

export function AboutProblemSolution() {
  return (
    <section className="py-20 bg-white border-b border-slate-200 text-slate-800 w-full">
      <div className="w-full max-w-[96vw] lg:max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
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

              {/* Resolution — Vayantara logo */}
              <div className="w-full max-w-[340px] sm:w-5/12 h-[200px] bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center justify-center p-4">
                <Image
                  src="/Hero middle.png"
                  alt="Vayantara Airfare Intelligence"
                  width={1536}
                  height={1024}
                  sizes="(max-width: 640px) 80vw, 280px"
                  className="h-full w-full object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
