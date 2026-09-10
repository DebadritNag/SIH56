import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

export function AboutMissionFooter() {
  return (
    <footer className="relative w-full text-white pt-24 sm:pt-32 pb-0 overflow-hidden border-t border-slate-800">
      {/* Full-Section Background Image - 100% Original Colors Without Dark Overlays */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <Image
          src="/About Bottom.png"
          alt="A More Connected And Equitable India"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>

      {/* Main Mission Content */}
      <div className="w-full max-w-[96vw] lg:max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10 pb-20 sm:pb-28">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Left Slogan */}
          <div className="hidden md:block w-1/4">
            <p className="text-[10px] uppercase font-bold tracking-[0.25em] text-slate-200 leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
              A More<br />Connected<br />And Equitable<br />India
            </p>
          </div>

          {/* Center CTA Content */}
          <div className="w-full md:w-2/4 text-center space-y-4">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight drop-shadow-[0_2px_14px_rgba(0,0,0,0.95)]">
              Our mission is a more informed India.
            </h2>
            <p className="text-xs sm:text-sm text-slate-100 max-w-md mx-auto leading-relaxed drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]">
              VAYANTARA enables transparent, timely and credible airfare intelligence for a stronger, more resilient and more equitable India.
            </p>
            <div className="pt-2">
              <Link
                href="/overview"
                className="glow-cyan-btn inline-flex items-center gap-2 bg-[#0284c7] hover:bg-[#0369a1] text-white font-semibold text-xs px-7 py-3 rounded-full shadow-2xl hover:shadow-cyan-500/30 transition duration-150 active:scale-95"
              >
                <span>Explore the Platform</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </Link>
            </div>
          </div>

          {/* Right Slogan */}
          <div className="hidden md:block w-1/4 text-right">
            <p className="text-[10px] uppercase font-bold tracking-[0.25em] text-slate-200 leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
              Better Data<br />Brighter Insights<br /><span className="text-cyan-400">Stronger India</span>
            </p>
          </div>
        </div>
      </div>

      {/* MoSPI & Shared Navigation Sub-Footer */}
      <div className="border-t border-slate-800/80 bg-[#020710]/95 py-8 px-4 sm:px-6 lg:px-12 text-center text-xs text-slate-400 relative z-10">
        <div className="w-full max-w-[96vw] lg:max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="relative h-6 w-28">
              <Image
                src="/top left.png"
                alt="VAYANTARA"
                fill
                sizes="120px"
                className="object-contain object-left filter brightness-110 opacity-85 hover:opacity-100 transition-opacity"
              />
            </div>
            <span className="text-slate-400">· National Airfare Price Index for India</span>
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
