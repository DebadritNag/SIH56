import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

export function AboutMissionFooter() {
  return (
    <footer className="relative bg-gradient-to-b from-[#050c18] via-[#08172c] to-[#040914] text-white pt-20 overflow-hidden border-t border-slate-800">
      {/* Map Network Backdrop graphic representation */}
      <div className="absolute inset-0 opacity-15 pointer-events-none flex items-center justify-center">
        <svg className="w-full max-w-4xl h-full" fill="none" viewBox="0 0 800 500">
          <circle cx="400" cy="250" r="220" stroke="#06b6d4" strokeDasharray="6 6" strokeWidth="1" />
          <circle cx="400" cy="250" r="140" stroke="#0284c7" strokeWidth="1" />
          <circle cx="400" cy="250" r="60" stroke="#00c8ff" strokeWidth="1.5" />
          <path d="M280 200 L 400 250 L 520 180 M 400 250 L 380 370 M 400 250 L 490 320" stroke="#38bdf8" strokeWidth="1.5" />
        </svg>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 pb-16">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Left Slogan */}
          <div className="hidden md:block w-1/4">
            <p className="text-[10px] uppercase font-bold tracking-[0.25em] text-slate-400 leading-relaxed">
              A More<br />Connected<br />And Equitable<br />India
            </p>
          </div>

          {/* Center CTA Content */}
          <div className="w-full md:w-2/4 text-center space-y-4">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Our mission is a more informed India.
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
              VAYANTARA enables transparent, timely and credible airfare intelligence for a stronger, more resilient and more equitable India.
            </p>
            <div className="pt-2">
              <Link
                href="/overview"
                className="inline-flex items-center gap-2 bg-[#0284c7] hover:bg-[#0369a1] text-white font-semibold text-xs px-6 py-3 rounded shadow transition duration-150 active:scale-95"
              >
                <span>Explore the Platform</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </Link>
            </div>
          </div>

          {/* Right Slogan */}
          <div className="hidden md:block w-1/4 text-right">
            <p className="text-[10px] uppercase font-bold tracking-[0.25em] text-slate-400 leading-relaxed">
              Better Data<br />Brighter Insights<br /><span className="text-cyan-400">Stronger India</span>
            </p>
          </div>
        </div>
      </div>

      {/* MoSPI & Shared Navigation Sub-Footer */}
      <div className="border-t border-slate-800/80 bg-[#020710]/90 py-8 px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="relative h-6 w-28">
              <Image
                src="/top left.png"
                alt="VAYANTARA"
                fill
                sizes="120px"
                className="object-contain object-left filter brightness-110 opacity-80 hover:opacity-100 transition-opacity"
              />
            </div>
            <span className="text-slate-500">· National Airfare Price Index for India</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6">
            <Link href="/login" className="hover:text-cyan-400 transition-colors">
              Sign In
            </Link>
            <Link href="/signup" className="hover:text-cyan-400 transition-colors">
              Request Access
            </Link>
            <Link href="/methodology" className="hover:text-cyan-400 transition-colors">
              Methodology Guide
            </Link>
            <Link href="/downloads" className="hover:text-cyan-400 transition-colors">
              Datasets &amp; Bulletins
            </Link>
          </div>

          <div>
            <span>© {new Date().getFullYear()} Ministry of Statistics &amp; Programme Implementation (MoSPI) · SIH26056</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
