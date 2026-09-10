import React from "react";
import { ArrowRight, BarChart3, Clock, FileText, LineChart, TrendingUp } from "lucide-react";

export function AboutCpiConnection() {
  return (
    <section className="py-20 bg-[#f0f7fd] border-b border-sky-100 text-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left: Description */}
          <div className="lg:col-span-5 space-y-4">
            <span className="text-xs uppercase tracking-[0.25em] font-bold text-sky-600 block">
              Connection to CPI &amp; Statistical Monitoring
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              A modern input for India’s economic measurement.
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              VAYANTARA’s Airfare Price Index (APIx) can serve as a high-frequency indicator to complement CPI components related to passenger transport and air travel services. It enables faster, more granular, and evidence-based economic analysis for government and research institutions.
            </p>
          </div>

          {/* Right: Flowchart Visual */}
          <div className="lg:col-span-7">
            <div className="bg-white/90 border border-sky-200/80 rounded-2xl p-6 sm:p-8 shadow-sm">
              {/* Primary Flow Line */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                {/* Box 1 */}
                <div className="w-full sm:w-1/3 bg-sky-50 border border-sky-100 rounded-xl p-4 text-center">
                  <div className="w-7 h-7 mx-auto text-sky-600 mb-1.5 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold text-slate-800">Observed Airfare Data</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">(Real-Time)</div>
                </div>

                {/* Connector 1 */}
                <div className="text-sky-400 rotate-90 sm:rotate-0">
                  <ArrowRight className="w-5 h-5" />
                </div>

                {/* Box 2 (Highlighted) */}
                <div className="w-full sm:w-1/3 bg-sky-100/70 border-2 border-sky-400 rounded-xl p-4 text-center relative shadow-sm">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-sky-700 block">
                    VAYANTARA
                  </span>
                  <div className="text-xs font-extrabold text-slate-900 mt-0.5">Airfare Price Index</div>
                  <div className="text-[10px] text-sky-800 font-semibold">(APIx)</div>
                </div>

                {/* Connector 2 */}
                <div className="text-sky-400 rotate-90 sm:rotate-0">
                  <ArrowRight className="w-5 h-5" />
                </div>

                {/* Box 3 */}
                <div className="w-full sm:w-1/3 bg-sky-50 border border-sky-100 rounded-xl p-4 text-center">
                  <div className="w-7 h-7 mx-auto text-sky-600 mb-1.5 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold text-slate-800">CPI &amp; Economic</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Analysis</div>
                </div>
              </div>

              {/* Lower 3 Supporting Sub-Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-5 border-t border-sky-100">
                <div className="flex items-center gap-2 justify-center py-2 px-3 bg-white rounded-lg border border-sky-100 text-slate-700">
                  <Clock className="w-4 h-4 text-sky-500" />
                  <span className="text-xs font-semibold">Timely Insights</span>
                </div>
                <div className="flex items-center gap-2 justify-center py-2 px-3 bg-white rounded-lg border border-sky-100 text-slate-700">
                  <LineChart className="w-4 h-4 text-sky-500" />
                  <span className="text-xs font-semibold">Granular Analysis</span>
                </div>
                <div className="flex items-center gap-2 justify-center py-2 px-3 bg-white rounded-lg border border-sky-100 text-slate-700">
                  <FileText className="w-4 h-4 text-sky-500" />
                  <span className="text-xs font-semibold">Evidence for Policy</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
