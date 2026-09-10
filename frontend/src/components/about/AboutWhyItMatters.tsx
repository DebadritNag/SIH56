import React from "react";
import Image from "next/image";
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
          <div className="lg:col-span-6 flex items-center justify-center">
            <div className="relative w-full max-w-xl mx-auto rounded-2xl overflow-hidden border border-slate-700/80 shadow-2xl shadow-cyan-950/40 bg-[#091528]/80 group">
              <Image
                src="/3rd-pic.png"
                alt="Air travel prices are signals of how India moves, works and grows"
                width={1448}
                height={1086}
                className="w-full h-auto object-contain rounded-2xl transition-transform duration-500 group-hover:scale-[1.02]"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
