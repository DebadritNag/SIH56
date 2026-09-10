"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Play, Plane, Layers, BarChart3, ShieldCheck } from "lucide-react";

export function AboutHero() {
  return (
    <section className="relative w-full min-h-[calc(100vh-76px)] min-h-[640px] sm:min-h-[700px] lg:min-h-[780px] xl:min-h-[850px] flex flex-col justify-between text-white overflow-hidden bg-[#030b17]">
      {/* Full-Width Background Image - Tuned to preserve India map, aircraft & runway lights */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <Image
          src="/About-back.png"
          alt="VAYANTARA Airfare Intelligence Network"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_32%] sm:object-[center_26%] lg:object-[center_24%] xl:object-[center_26%]"
        />
      </div>

      {/* Main Content Area - Shifted toward left edge (5-8vw) matching landing page */}
      <div className="w-full px-4 sm:px-6 md:px-8 lg:px-[6vw] xl:px-[7vw] pt-10 sm:pt-14 pb-6 sm:pb-8 relative z-10 flex-1 flex flex-col justify-between">
        {/* Top Meta Tagline */}
        <div className="flex justify-between items-start mb-6 sm:mb-8">
          <span className="text-xs uppercase tracking-[0.25em] font-semibold text-cyan-400 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
            About VAYANTARA
          </span>
          <div className="hidden lg:block text-right">
            <p className="text-[10px] tracking-[0.22em] font-semibold text-slate-300 leading-relaxed uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
              Real Data<br />Real Connections<br />
              <span className="text-cyan-400">A Stronger India</span>
            </p>
          </div>
        </div>

        {/* Hero Narrative Block - Positioned Far Left, No Heavy Box Covering Background */}
        <div className="my-auto py-4 max-w-xl lg:max-w-[560px]">
          <div className="p-0 sm:p-2">
            <h1 className="text-4xl sm:text-5xl lg:text-[52px] font-extrabold tracking-tight leading-[1.14] drop-shadow-[0_3px_12px_rgba(0,0,0,0.95)]">
              From airfare movement to{" "}
              <span className="text-[#00c8ff] inline-block drop-shadow-[0_0_24px_rgba(0,200,255,0.45)]">
                economic intelligence.
              </span>
            </h1>

            <p className="text-slate-100 text-base sm:text-lg leading-relaxed mt-5 font-normal drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
              VAYANTARA transforms dynamic airfare data into a transparent, high-frequency Airfare Price Index (APIx) to support better economic measurement and policy decisions for India.
            </p>

            {/* CTA Action Buttons */}
            <div className="pt-6 flex flex-wrap gap-4 items-center">
              <Link
                href="/methodology"
                className="glow-cyan-btn inline-flex items-center gap-2.5 bg-[#0284c7] hover:bg-[#0369a1] text-white font-semibold text-sm px-6 py-3 rounded-full shadow-lg transition duration-200"
              >
                <span>Explore Methodology</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/overview"
                className="inline-flex items-center gap-2.5 bg-[#0e1f36]/80 hover:bg-[#132a48] text-slate-200 border border-slate-600/80 font-medium text-sm px-6 py-3 rounded-full transition duration-200 backdrop-blur-sm shadow-md"
              >
                <span className="w-5 h-5 rounded-full border border-slate-300 flex items-center justify-center">
                  <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
                </span>
                <span>See Platform</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Hero Bottom KPI Strip - Lightweight, Letting Airport Runway Lights Shine Through */}
        <div className="mt-6 pt-5 border-t border-white/10 backdrop-blur-[2px] bg-[#030b17]/30 rounded-xl p-3.5 sm:p-5 grid grid-cols-2 md:grid-cols-5 gap-5 sm:gap-6 items-center">
          {/* Metric 1 */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-950/80 border border-blue-500/30 text-cyan-400 shrink-0">
              <Plane className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-bold text-white leading-none drop-shadow">1,000+</div>
              <div className="text-[11px] text-slate-300 mt-1 uppercase font-medium">Routes Monitored</div>
            </div>
          </div>

          {/* Metric 2 */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-950/80 border border-blue-500/30 text-cyan-400 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-bold text-white leading-none drop-shadow">Multiple</div>
              <div className="text-[11px] text-slate-300 mt-1 uppercase font-medium leading-tight">
                Data Sources <span className="text-slate-400 text-[10px] block">(OTA + Airlines)</span>
              </div>
            </div>
          </div>

          {/* Metric 3 */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-950/80 border border-blue-500/30 text-cyan-400 shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-bold text-white leading-none drop-shadow">Real-Time</div>
              <div className="text-[11px] text-slate-300 mt-1 uppercase font-medium">Airfare Intelligence</div>
            </div>
          </div>

          {/* Metric 4 */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-950/80 border border-blue-500/30 text-cyan-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-bold text-white leading-none drop-shadow">94.8%</div>
              <div className="text-[11px] text-slate-300 mt-1 uppercase font-medium">Data Confidence</div>
            </div>
          </div>

          {/* Tagline Right Col */}
          <div className="col-span-2 md:col-span-1 text-right border-l-0 md:border-l border-white/15 md:pl-4">
            <span className="text-[9px] font-bold tracking-[0.2em] text-slate-300 uppercase leading-snug block drop-shadow">
              Data Insights Progress<br />
              <span className="text-cyan-400">For a Stronger Tomorrow</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
