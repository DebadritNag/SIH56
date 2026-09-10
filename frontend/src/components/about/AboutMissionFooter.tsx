import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

export function AboutMissionFooter() {
  return (
    <footer className="relative bg-gradient-to-b from-[#050c18] via-[#08172c] to-[#040914] text-white pt-20 overflow-hidden border-t border-slate-800">
      {/* Background Panoramic Graphic */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <Image
          src="/About Bottom.png"
          alt="A More Connected And Equitable India"
          fill
          sizes="100vw"
          className="object-cover object-center opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050c18]/90 via-[#050c18]/40 to-[#040914] pointer-events-none" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 pb-16">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Left Slogan */}
          <div className="hidden md:block w-1/4">
            <p className="text-[10px] uppercase font-bold tracking-[0.25em] text-slate-300 leading-relaxed">
              A More<br />Connected<br />And Equitable<br />India
            </p>
          </div>

          {/* Center CTA Content */}
          <div className="w-full md:w-2/4 text-center space-y-4">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">
              Our mission is a more informed India.
            </h2>
            <p className="text-xs sm:text-sm text-slate-200 max-w-md mx-auto leading-relaxed drop-shadow-sm">
              VAYANTARA enables transparent, timely and credible airfare intelligence for a stronger, more resilient and more equitable India.
            </p>
            <div className="pt-2">
              <Link
                href="/overview"
                className="inline-flex items-center gap-2 bg-[#0284c7] hover:bg-[#0369a1] text-white font-semibold text-xs px-6 py-3 rounded shadow-lg hover:shadow-cyan-500/20 transition duration-150 active:scale-95"
              >
                <span>Explore the Platform</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </Link>
            </div>
          </div>

          {/* Right Slogan */}
          <div className="hidden md:block w-1/4 text-right">
            <p className="text-[10px] uppercase font-bold tracking-[0.25em] text-slate-300 leading-relaxed">
              Better Data<br />Brighter Insights<br /><span className="text-cyan-400">Stronger India</span>
            </p>
          </div>
        </div>
      </div>

      {/* MoSPI & Shared Navigation Sub-Footer */}
      <div className="border-t border-slate-800/80 bg-[#020710]/95 py-8 px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500 relative z-10">
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
