import React from "react";
import Image from "next/image";

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

          {/* Right: Flowchart Image */}
          <div className="lg:col-span-7 flex items-center justify-center">
            <div className="relative w-full max-w-2xl mx-auto rounded-2xl bg-white border border-sky-200/80 p-3 sm:p-5 shadow-sm hover:shadow-md transition-shadow duration-300">
              <Image
                src="/flow.png"
                alt="Observed Airfare Data to CPI & Economic Analysis Flowchart"
                width={1536}
                height={1024}
                className="w-full h-auto object-contain drop-shadow-sm"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
