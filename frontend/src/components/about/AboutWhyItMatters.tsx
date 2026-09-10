import React from "react";
import { TrendingUp, Users, Building2, FileText } from "lucide-react";

export function AboutWhyItMatters() {
  return (
    <section className="py-20 bg-[#050c18] text-white border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Side: Content & 4 Features */}
          <div className="lg:col-span-6 space-y-6">
            <span className="text-xs uppercase tracking-[0.25em] font-bold text-cyan-400">
              Why Airfare Measurement Matters
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
              Airfares are a key indicator of <span className="text-cyan-400">economic activity.</span>
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Air travel is closely linked to business activity, tourism, mobility, and overall demand. Systematic measurement of airfare changes helps capture real-time signals of economic trends, complementing traditional indicators.
            </p>

            {/* 4 Pillars Grid */}
            <div className="grid grid-cols-2 gap-4 pt-4">
              {/* Item 1 */}
              <div className="bg-[#091528] p-4 rounded-xl border border-slate-800/80">
                <div className="w-8 h-8 rounded bg-cyan-950/80 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-2.5">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-white mb-1">Reflects demand &amp; mobility</h3>
              </div>

              {/* Item 2 */}
              <div className="bg-[#091528] p-4 rounded-xl border border-slate-800/80">
                <div className="w-8 h-8 rounded bg-cyan-950/80 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-2.5">
                  <Users className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-white mb-1">Sensitive to economic cycles</h3>
              </div>

              {/* Item 3 */}
              <div className="bg-[#091528] p-4 rounded-xl border border-slate-800/80">
                <div className="w-8 h-8 rounded bg-cyan-950/80 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-2.5">
                  <Building2 className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-white mb-1">Useful for tourism &amp; regional growth</h3>
              </div>

              {/* Item 4 */}
              <div className="bg-[#091528] p-4 rounded-xl border border-slate-800/80">
                <div className="w-8 h-8 rounded bg-cyan-950/80 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-2.5">
                  <FileText className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-white mb-1">Supports better policy decisions</h3>
              </div>
            </div>
          </div>

          {/* Right Side: Graphic Representation with Wing / Skyline Overlay */}
          <div className="lg:col-span-6 relative">
            <div className="relative rounded-2xl overflow-hidden border border-slate-700/60 shadow-2xl group">
              {/* Visual Wing over Sunset Backdrop */}
              <div className="h-80 sm:h-96 w-full bg-gradient-to-tr from-[#020b18] via-[#0d2244] to-[#f59e0b]/40 relative flex items-end">
                {/* Airplane Wing Silhouette vector representation */}
                <svg
                  className="absolute inset-0 w-full h-full object-cover"
                  fill="none"
                  preserveAspectRatio="xMidYMid slice"
                  viewBox="0 0 600 350"
                >
                  <path d="M0,280 L280,180 L520,60 L600,0 L600,350 L0,350 Z" fill="#040b17" fillOpacity="0.8" />
                  <path d="M120,350 L340,160 L450,110 L480,90 L400,280 Z" fill="#081b33" fillOpacity="0.9" />
                  <circle cx="480" cy="80" fill="#f59e0b" fillOpacity="0.2" filter="blur(40px)" r="140" />
                </svg>

                {/* Quote Overlay Box */}
                <div className="relative z-10 p-6 sm:p-8 bg-gradient-to-t from-[#050c18] via-[#050c18]/90 to-transparent w-full">
                  <div className="text-cyan-400 text-3xl font-serif leading-none mb-2">“</div>
                  <blockquote className="text-slate-100 text-sm sm:text-base italic font-medium leading-relaxed mb-4">
                    Air travel prices are more than just fares — they are signals of how India moves, works and grows.
                  </blockquote>
                  <div className="h-0.5 w-12 bg-cyan-400 mb-3" />
                  <div className="text-[9px] uppercase tracking-[0.25em] text-slate-400 font-bold flex flex-wrap gap-x-3">
                    <span>People</span>
                    <span>•</span>
                    <span>Connect</span>
                    <span>•</span>
                    <span>Mobility</span>
                    <span>•</span>
                    <span>Opportunity</span>
                    <span>•</span>
                    <span>Progress</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
