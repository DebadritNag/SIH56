"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Play, Plane, Layers, BarChart3, ShieldCheck } from "lucide-react";

export function AboutHero() {
  return (
    <section className="relative bg-gradient-to-b from-[#050c18] via-[#071326] to-[#040812] text-white pt-16 pb-24 border-b border-slate-800/80 overflow-hidden">
      {/* Grid & Radial Ambient Backdrops */}
      <div className="absolute inset-0 grid-lines-bg grid-radial-mask pointer-events-none opacity-40" />
      <div className="absolute top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute right-10 top-20 w-[450px] h-[450px] bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Top Meta Tagline */}
        <div className="flex justify-between items-start mb-6">
          <span className="text-xs uppercase tracking-[0.25em] font-semibold text-cyan-400">
            About VAYANTARA
          </span>
          <div className="hidden lg:block text-right">
            <p className="text-[10px] tracking-[0.22em] font-semibold text-slate-400 leading-relaxed uppercase">
              Real Data<br />Real Connections<br />
              <span className="text-cyan-400">A Stronger India</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Hero Left Column: Headline & Intro */}
          <div className="lg:col-span-7 space-y-6">
            <h1 className="text-4xl sm:text-5xl lg:text-[52px] font-extrabold tracking-tight leading-[1.15]">
              From airfare movement to{" "}
              <span className="text-[#00c8ff] inline-block">economic intelligence.</span>
            </h1>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-xl font-normal">
              VAYANTARA transforms dynamic airfare data into a transparent, high-frequency Airfare Price Index (APIx) to support better economic measurement and policy decisions for India.
            </p>

            {/* CTA Action Buttons */}
            <div className="pt-3 flex flex-wrap gap-4 items-center">
              <Link
                href="/methodology"
                className="inline-flex items-center gap-2.5 bg-[#0284c7] hover:bg-[#0369a1] text-white font-semibold text-sm px-6 py-3 rounded shadow-md hover:shadow-cyan-500/20 transition duration-200"
              >
                <span>Explore Methodology</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/overview"
                className="inline-flex items-center gap-2.5 bg-[#0e1f36]/80 hover:bg-[#132a48] text-slate-200 border border-slate-700/80 font-medium text-sm px-6 py-3 rounded transition duration-200"
              >
                <span className="w-5 h-5 rounded-full border border-slate-400 flex items-center justify-center">
                  <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
                </span>
                <span>See Platform</span>
              </Link>
            </div>
          </div>

          {/* Hero Right Column: Main Image */}
          <div className="lg:col-span-5 relative flex items-center justify-center">
            <div className="relative w-full rounded-2xl overflow-hidden border border-slate-700/80 shadow-2xl shadow-cyan-950/50 bg-[#091528]/90 group">
              <Image
                src="/About-back.png"
                alt="VAYANTARA Airfare Intelligence Network"
                width={1672}
                height={941}
                priority
                className="w-full h-auto object-cover rounded-2xl transition-transform duration-500 group-hover:scale-[1.02]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#050c18]/90 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-3.5 left-4 right-4 flex items-center justify-between text-xs text-slate-200 font-medium">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                  Airfare Price Index (APIx)
                </span>
                <span className="text-cyan-400 font-mono text-[11px] font-semibold bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/30">
                  Live Signal · T+1
                </span>
              </div>
            </div>

            {/* Network lines illustration representation behind */}
            <div className="absolute -bottom-10 -right-6 -z-10 opacity-30 pointer-events-none hidden sm:block">
              <svg fill="none" height="200" viewBox="0 0 240 200" width="240">
                <path d="M20 180 C 70 80, 160 50, 220 20" stroke="#06b6d4" strokeDasharray="4 4" strokeWidth="1.5" />
                <path d="M40 190 C 110 130, 180 90, 230 60" stroke="#0284c7" strokeWidth="1" />
              </svg>
            </div>
          </div>
        </div>

        {/* Hero Bottom KPI Strip */}
        <div className="mt-16 pt-8 border-t border-slate-800 grid grid-cols-2 md:grid-cols-5 gap-6 items-center">
          {/* Metric 1 */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-950/60 border border-blue-500/20 text-cyan-400 shrink-0">
              <Plane className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-bold text-white leading-none">1,000+</div>
              <div className="text-[11px] text-slate-400 mt-1 uppercase font-medium">Routes Monitored</div>
            </div>
          </div>

          {/* Metric 2 */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-950/60 border border-blue-500/20 text-cyan-400 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-bold text-white leading-none">Multiple</div>
              <div className="text-[11px] text-slate-400 mt-1 uppercase font-medium leading-tight">
                Data Sources <span className="text-slate-500 text-[10px] block">(OTA + Airlines)</span>
              </div>
            </div>
          </div>

          {/* Metric 3 */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-950/60 border border-blue-500/20 text-cyan-400 shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-bold text-white leading-none">Real-Time</div>
              <div className="text-[11px] text-slate-400 mt-1 uppercase font-medium">Airfare Intelligence</div>
            </div>
          </div>

          {/* Metric 4 */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-950/60 border border-blue-500/20 text-cyan-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-bold text-white leading-none">94.8%</div>
              <div className="text-[11px] text-slate-400 mt-1 uppercase font-medium">Data Confidence</div>
            </div>
          </div>

          {/* Tagline Right Col */}
          <div className="col-span-2 md:col-span-1 text-right border-l-0 md:border-l border-slate-800/80 md:pl-4">
            <span className="text-[9px] font-bold tracking-[0.2em] text-slate-400 uppercase leading-snug block">
              Data Insights Progress<br />
              <span className="text-cyan-400">For a Stronger Tomorrow</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
