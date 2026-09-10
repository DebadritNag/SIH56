import React from "react";
import Image from "next/image";
import { Layers, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";

export function AboutWhatIs() {
  return (
    <section className="py-20 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
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

          {/* Right Side: 5-Stage Layered Diagram Image */}
          <div className="lg:col-span-6 flex items-center justify-center">
            <div className="relative w-full max-w-xl mx-auto rounded-2xl bg-white border border-slate-200/90 p-3 sm:p-5 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <span className="text-xs uppercase tracking-[0.25em] font-bold text-slate-500 mb-3 block text-center sm:text-left">
                From Data to Economic Insight
              </span>
              <Image
                src="/layered.png"
                alt="VAYANTARA Data to Economic Insight Layered Architecture"
                width={1448}
                height={1086}
                className="w-full h-auto object-contain"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
