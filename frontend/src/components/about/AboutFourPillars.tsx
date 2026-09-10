import React from "react";
import { ShieldCheck, Layers, Cpu, FileCheck } from "lucide-react";

export function AboutFourPillars() {
  return (
    <section className="py-20 bg-[#050c18] text-white border-b border-slate-800 w-full">
      <div className="w-full max-w-[96vw] lg:max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="text-center sm:text-left mb-12">
          <span className="text-xs uppercase tracking-[0.25em] font-bold text-cyan-400 block mb-2">
            Our Four Pillars
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            A stronger data foundation for a stronger India.
          </h2>
        </div>

        {/* 4 Pillars Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Pillar 1 */}
          <div className="bg-[#091528] border border-slate-800 rounded-xl p-6 hover:border-cyan-500/40 transition duration-200 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-cyan-950/70 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white mb-2">Trust</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Transparent methodology, auditable data, and clear documentation.
              </p>
            </div>
          </div>

          {/* Pillar 2 */}
          <div className="bg-[#091528] border border-slate-800 rounded-xl p-6 hover:border-cyan-500/40 transition duration-200 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-cyan-950/70 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white mb-2">Resilience</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Multi-source data, robust pipelines, and continuous monitoring.
              </p>
            </div>
          </div>

          {/* Pillar 3 */}
          <div className="bg-[#091528] border border-slate-800 rounded-xl p-6 hover:border-cyan-500/40 transition duration-200 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-cyan-950/70 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white mb-2">Intelligence</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Advanced analytics and explainable AI for meaningful insights.
              </p>
            </div>
          </div>

          {/* Pillar 4 */}
          <div className="bg-[#091528] border border-slate-800 rounded-xl p-6 hover:border-cyan-500/40 transition duration-200 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-cyan-950/70 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4">
                <FileCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white mb-2">
                Statistical Integrity
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Aligned with national statistical principles and best practices.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
