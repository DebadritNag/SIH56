"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Cpu,
  Database,
  Download,
  FileText,
  Fingerprint,
  LineChart,
  Lock,
  MapPin,
  Radio,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";

import { CountUp } from "@/components/landing/CountUp";
import { VayantaraLogo } from "@/components/ui/VayantaraLogo";
import { useAuth } from "@/lib/providers/AuthProvider";
import { PublicNavbar } from "@/components/public/PublicNavbar";

const NAV_TICKER = [
  { route: "DEL–BOM", change: "+11.4%", up: true },
  { route: "BLR–DEL", change: "+8.9%", up: true },
  { route: "BOM–GOI", change: "-6.4%", up: false },
  { route: "DEL–CCU", change: "+6.8%", up: true },
  { route: "HYD–DEL", change: "+5.3%", up: true },
  { route: "BOM–BLR", change: "+7.2%", up: true },
  { route: "DEL–COK", change: "-5.1%", up: false },
  { route: "CCU–GAU", change: "-3.8%", up: false },
];

export default function LandingPage() {
  const router = useRouter();
  const { session, loading } = useAuth();

  // If already signed in, skip the landing page.
  useEffect(() => {
    if (!loading && session) router.replace("/overview");
  }, [loading, session, router]);

  return (
    <div className="bg-[#030B17] text-slate-100 font-sans antialiased selection:bg-brand-cyan selection:text-black overflow-x-hidden min-h-screen relative flex flex-col justify-between">
      <div className="relative z-10 flex flex-col justify-between min-h-screen">
        {/* BEGIN: HeaderNav — shared PublicNavbar component */}
        <PublicNavbar active="home" />
        {/* END: HeaderNav */}

        {/* BEGIN: HeroSection (Section-Restricted Background & Luminous Center Lighting) */}
        <section className="relative overflow-hidden pt-8 pb-12 sm:pt-10 sm:pb-16 lg:pt-12 lg:pb-16 min-h-[580px] lg:min-h-[660px] flex flex-col justify-center">
          {/* Hero-Only Background & Lighting Layer */}
          <div aria-hidden="true" className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
            {/* Vivid Background Panorama Restricted to Hero */}
            <Image
              src="/background.png"
              alt="VAYANTARA Aviation Background Panorama"
              fill
              priority
              sizes="100vw"
              className="object-cover object-center filter brightness-105 contrast-105 opacity-90 sm:opacity-95"
            />

            {/* Atmospheric Center Illumination behind Middle Logo */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] sm:w-[800px] lg:w-[950px] h-[360px] sm:h-[460px] bg-gradient-to-r from-sky-400/30 via-brand-cyan/25 to-blue-500/25 rounded-full blur-[90px] pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] sm:w-[380px] h-[180px] sm:h-[240px] bg-white/20 rounded-full blur-[45px] pointer-events-none" />

            {/* Subtle Top Vignette for Nav Contrast */}
            <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-[#061522]/50 to-transparent" />

            {/* Clean Bottom Transition into Dark Canvas */}
            <div className="absolute bottom-0 inset-x-0 h-28 sm:h-36 bg-gradient-to-t from-[#030B17] via-[#030B17]/85 to-transparent" />
          </div>

          {/* Hero Content Container with Consistent 94vw Container */}
          <div className="relative z-10 w-full max-w-[94vw] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-12 items-center gap-4 py-4">
              {/* Left Side Micro-Typography Narrative */}
              <div className="col-span-12 lg:col-span-3 text-left hidden lg:block space-y-7 pl-2">
                <div className="space-y-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                  <div className="text-xs tracking-[0.25em] font-bold text-white">OBSERVE</div>
                  <div className="text-xs tracking-[0.25em] font-bold text-white">ANALYZE</div>
                  <div className="text-xs tracking-[0.25em] font-bold text-white">INDEX</div>
                  <div className="text-xs tracking-[0.22em] font-black text-cyan-300">FOR A STRONGER INDIA</div>
                </div>
                <p className="text-[11px] leading-relaxed tracking-[0.2em] font-medium text-slate-200 uppercase max-w-[220px] drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                  A data driven contribution to a more connected and equitable India
                </p>
              </div>

              {/* Center Stage: Big Hero Identity & CTAs */}
              <div className="col-span-12 lg:col-span-6 text-center flex flex-col items-center justify-center px-4">
                {/* Centered Hero Logo / Brand Artwork with bright backlighting and crisp hairline contrast */}
                <div className="relative w-full max-w-[340px] sm:max-w-[440px] lg:max-w-[500px] h-[150px] sm:h-[190px] lg:h-[220px] mb-2 group cursor-pointer">
                  {/* Dedicated local aura behind the artwork */}
                  <div className="absolute inset-0 -m-4 bg-gradient-to-b from-sky-400/35 via-cyan-400/25 to-transparent rounded-full blur-2xl pointer-events-none" />
                  <Image
                    src="/Hero middle.png"
                    alt="VAYANTARA — Real-Time Airfare Intelligence & Price Index for India"
                    fill
                    priority
                    sizes="(max-width: 640px) 340px, (max-width: 1024px) 440px, 500px"
                    className="object-contain filter drop-shadow-[0_0_2px_rgba(255,255,255,0.95)] drop-shadow-[0_0_24px_rgba(0,210,255,0.8)] brightness-120 contrast-110 transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </div>

                {/* Accessible H1 heading for SEO and screen readers */}
                <h1 className="sr-only">VAYANTARA — Real-Time Airfare Intelligence &amp; Price Index for India</h1>

                {/* Divider Subtitle */}
                <div className="flex items-center justify-center gap-3 text-xs sm:text-sm tracking-wider font-light mb-6 w-full mt-2 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                  <span className="h-[1px] w-12 sm:w-20 bg-gradient-to-r from-transparent via-brand-cyan to-brand-cyan" />
                  <span className="text-cyan-200 font-semibold text-center tracking-wide">
                    Turning Airfare Movement into Economic Signal
                  </span>
                  <span className="h-[1px] w-12 sm:w-20 bg-gradient-to-l from-transparent via-brand-cyan to-brand-cyan" />
                </div>

                {/* Action Buttons Group */}
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <Link
                    className="glow-cyan-btn inline-flex items-center px-7 py-3 rounded-full text-xs sm:text-sm font-bold bg-gradient-to-r from-[#00D2FF] to-[#0284C7] text-brand-dark hover:brightness-110 active:scale-95 transition-all shadow-[0_0_25px_rgba(0,210,255,0.6)] cursor-pointer"
                    href="/overview"
                  >
                    Explore Live Dashboard <span className="ml-2 font-black">→</span>
                  </Link>
                  <a
                    className="inline-flex items-center px-7 py-3 rounded-full text-xs sm:text-sm font-semibold bg-brand-navy/90 hover:bg-slate-800 text-white border border-brand-cyan/40 hover:border-brand-cyan shadow-lg backdrop-blur-md transition-all cursor-pointer"
                    href="#about"
                  >
                    <span className="w-4 h-4 rounded-full bg-brand-cyan/20 flex items-center justify-center mr-2 text-[10px] text-brand-cyan">
                      ▶
                    </span>
                    Learn More
                  </a>
                </div>
              </div>

              {/* Right Side Micro-Typography Narrative */}
              <div className="col-span-12 lg:col-span-3 text-right hidden lg:block space-y-16 pr-2">
                <div className="space-y-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                  <div className="text-xs tracking-[0.25em] font-bold text-white">INDIA&apos;S</div>
                  <div className="text-xs tracking-[0.25em] font-bold text-white">AIR TRAVEL DATA</div>
                  <div className="text-xs tracking-[0.25em] font-bold text-white">A STRONGER</div>
                  <div className="text-xs tracking-[0.22em] font-black text-cyan-300">ECONOMY TOMORROW</div>
                </div>
                <div className="space-y-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                  <div className="text-[11px] tracking-[0.28em] font-bold text-slate-300">PEOPLE</div>
                  <div className="text-[11px] tracking-[0.28em] font-bold text-slate-300">POLICY</div>
                  <div className="text-[11px] tracking-[0.28em] font-bold text-slate-300">PROGRESS</div>
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* END: HeroSection */}

        {/* Main Content Area: KPI Strip, Feature Cards, Ticker, Impact Banner */}
        <main className="relative flex-grow flex flex-col justify-center px-4 sm:px-6 lg:px-8 pt-3 pb-8">
          {/* Ambient subtle background glow and texture for rich depth without overpowering */}
          <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[85vw] max-w-[1300px] h-[450px] bg-gradient-to-b from-brand-cyan/5 via-sky-500/[0.03] to-transparent rounded-full blur-[120px]" />
          </div>

          <div className="w-full max-w-[94vw] mx-auto space-y-4 relative z-10">
            {/* BEGIN: LiveMetricsTicker (KPI Strip) */}
            <section aria-label="Real-Time Metrics" className="w-full">
              <div className="rounded-2xl px-6 sm:px-8 py-5 flex flex-wrap xl:flex-nowrap items-center justify-between gap-6 border border-cyan-500/25 bg-gradient-to-r from-[#071b30]/95 via-[#0a2642]/90 to-[#07192d]/95 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.15)]">
                {/* Metric 1: National APIx */}
                <div className="flex items-center gap-4 min-w-[180px]">
                  <div className="text-brand-cyan shrink-0">
                    <svg className="w-6 h-6 transform -rotate-45 drop-shadow-[0_0_8px_rgba(0,210,255,0.6)]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CountUp
                        end={108.43}
                        decimals={2}
                        className="text-xl sm:text-2xl font-bold tracking-tight text-white font-display tabular-nums"
                      />
                      <span className="text-xs font-semibold text-emerald-400 flex items-center">↑ +4.2%</span>
                    </div>
                    <p className="text-[10px] tracking-wider text-slate-400 uppercase font-medium mt-0.5">NATIONAL APIx</p>
                  </div>
                </div>

                <div className="hidden xl:block w-[1px] h-10 bg-white/10 shrink-0" />

                {/* Metric 2: Quotes / 24H */}
                <div className="flex items-center gap-4 min-w-[180px]">
                  <div className="text-brand-cyan shrink-0">
                    <Database className="w-6 h-6 drop-shadow-[0_0_8px_rgba(0,210,255,0.6)]" />
                  </div>
                  <div>
                    <CountUp
                      end={28452}
                      className="text-xl sm:text-2xl font-bold tracking-tight text-white font-display tabular-nums"
                    />
                    <p className="text-[10px] tracking-wider text-slate-400 uppercase font-medium mt-0.5">QUOTES / 24H</p>
                  </div>
                </div>

                <div className="hidden xl:block w-[1px] h-10 bg-white/10 shrink-0" />

                {/* Metric 3: Data Confidence */}
                <div className="flex items-center gap-4 min-w-[180px]">
                  <div className="text-brand-cyan shrink-0">
                    <BarChart3 className="w-6 h-6 drop-shadow-[0_0_8px_rgba(0,210,255,0.6)]" />
                  </div>
                  <div>
                    <CountUp
                      end={94.8}
                      decimals={1}
                      suffix="%"
                      className="text-xl sm:text-2xl font-bold tracking-tight text-white font-display tabular-nums"
                    />
                    <p className="text-[10px] tracking-wider text-slate-400 uppercase font-medium mt-0.5">DATA CONFIDENCE</p>
                  </div>
                </div>

                <div className="hidden xl:block w-[1px] h-10 bg-white/10 shrink-0" />

                {/* Metric 4: Routes Tracked */}
                <div className="flex items-center gap-4 min-w-[170px]">
                  <div className="text-brand-cyan shrink-0">
                    <Zap className="w-6 h-6 drop-shadow-[0_0_8px_rgba(0,210,255,0.6)]" />
                  </div>
                  <div>
                    <CountUp
                      end={81}
                      className="text-xl sm:text-2xl font-bold tracking-tight text-white font-display tabular-nums"
                    />
                    <p className="text-[10px] tracking-wider text-slate-400 uppercase font-medium mt-0.5">ROUTES TRACKED</p>
                  </div>
                </div>

                <div className="hidden xl:block w-[1px] h-10 bg-white/10 shrink-0" />

                {/* Status Indicators Right Side */}
                <div className="flex items-center gap-3 text-[10px] tracking-widest uppercase font-semibold text-slate-300 shrink-0">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_8px_#10B981]" />
                  </span>
                  <span className="text-emerald-400">LIVE DATA</span>
                  <span className="text-slate-600">•</span>
                  <span>MULTIPLE SOURCES</span>
                  <span className="text-slate-600">•</span>
                  <span>TRANSPARENT METHODOLOGY</span>
                </div>
              </div>
            </section>
            {/* END: LiveMetricsTicker */}

            {/* BEGIN: FeatureCardsGrid (6 cohesive cards spanning full width) */}
            <section id="features" aria-label="Core Capabilities" className="w-full">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-3.5">
                {/* Card 1: Airfare Price Index */}
                <Link
                  href="/apix"
                  className="rounded-xl p-5 sm:p-6 flex flex-col justify-between group min-h-[175px] cursor-pointer bg-gradient-to-b from-[#081f38]/90 via-[#06182c]/90 to-[#040f1d]/90 border border-cyan-500/25 hover:border-cyan-400/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_4px_20px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_25px_rgba(0,210,255,0.15)] hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div>
                    <div className="text-brand-cyan mb-3.5">
                      <LineChart className="w-5 h-5 drop-shadow-[0_0_6px_rgba(0,210,255,0.5)]" />
                    </div>
                    <h3 className="text-sm font-bold text-white mb-2 tracking-tight">Airfare Price Index</h3>
                    <p className="text-xs text-slate-300/85 leading-relaxed">Track real-time and historical price movements</p>
                  </div>
                  <div className="flex justify-end pt-4 mt-auto">
                    <span className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center text-slate-400 group-hover:text-brand-cyan group-hover:border-cyan-400/60 group-hover:bg-cyan-500/10 text-xs transition-all">
                      →
                    </span>
                  </div>
                </Link>

                {/* Card 2: Route Intelligence */}
                <Link
                  href="/routes"
                  className="rounded-xl p-5 sm:p-6 flex flex-col justify-between group min-h-[175px] cursor-pointer bg-gradient-to-b from-[#081f38]/90 via-[#06182c]/90 to-[#040f1d]/90 border border-cyan-500/25 hover:border-cyan-400/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_4px_20px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_25px_rgba(0,210,255,0.15)] hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div>
                    <div className="text-brand-cyan mb-3.5">
                      <MapPin className="w-5 h-5 drop-shadow-[0_0_6px_rgba(0,210,255,0.5)]" />
                    </div>
                    <h3 className="text-sm font-bold text-white mb-2 tracking-tight">Route Intelligence</h3>
                    <p className="text-xs text-slate-300/85 leading-relaxed">
                      Compare fares across routes, airlines and time windows
                    </p>
                  </div>
                  <div className="flex justify-end pt-4 mt-auto">
                    <span className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center text-slate-400 group-hover:text-brand-cyan group-hover:border-cyan-400/60 group-hover:bg-cyan-500/10 text-xs transition-all">
                      →
                    </span>
                  </div>
                </Link>

                {/* Card 3: Booking Window Analysis */}
                <Link
                  href="/booking-windows"
                  className="rounded-xl p-5 sm:p-6 flex flex-col justify-between group min-h-[175px] cursor-pointer bg-gradient-to-b from-[#081f38]/90 via-[#06182c]/90 to-[#040f1d]/90 border border-cyan-500/25 hover:border-cyan-400/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_4px_20px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_25px_rgba(0,210,255,0.15)] hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div>
                    <div className="text-brand-cyan mb-3.5">
                      <Calendar className="w-5 h-5 drop-shadow-[0_0_6px_rgba(0,210,255,0.5)]" />
                    </div>
                    <h3 className="text-sm font-bold text-white mb-2 tracking-tight">Booking Window Analysis</h3>
                    <p className="text-xs text-slate-300/85 leading-relaxed">Understand how fares change over time</p>
                  </div>
                  <div className="flex justify-end pt-4 mt-auto">
                    <span className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center text-slate-400 group-hover:text-brand-cyan group-hover:border-cyan-400/60 group-hover:bg-cyan-500/10 text-xs transition-all">
                      →
                    </span>
                  </div>
                </Link>

                {/* Card 4: Data & Provenance */}
                <Link
                  href="/ingestion"
                  className="rounded-xl p-5 sm:p-6 flex flex-col justify-between group min-h-[175px] cursor-pointer bg-gradient-to-b from-[#081f38]/90 via-[#06182c]/90 to-[#040f1d]/90 border border-cyan-500/25 hover:border-cyan-400/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_4px_20px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_25px_rgba(0,210,255,0.15)] hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div>
                    <div className="text-brand-cyan mb-3.5">
                      <ShieldCheck className="w-5 h-5 drop-shadow-[0_0_6px_rgba(0,210,255,0.5)]" />
                    </div>
                    <h3 className="text-sm font-bold text-white mb-2 tracking-tight">Data &amp; Provenance</h3>
                    <p className="text-xs text-slate-300/85 leading-relaxed">
                      Transparent, auditable and verifiable data pipeline
                    </p>
                  </div>
                  <div className="flex justify-end pt-4 mt-auto">
                    <span className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center text-slate-400 group-hover:text-brand-cyan group-hover:border-cyan-400/60 group-hover:bg-cyan-500/10 text-xs transition-all">
                      →
                    </span>
                  </div>
                </Link>

                {/* Card 5: AI & Anomaly Detection */}
                <Link
                  href="/anomalies"
                  className="rounded-xl p-5 sm:p-6 flex flex-col justify-between group min-h-[175px] cursor-pointer bg-gradient-to-b from-[#081f38]/90 via-[#06182c]/90 to-[#040f1d]/90 border border-cyan-500/25 hover:border-cyan-400/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_4px_20px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_25px_rgba(0,210,255,0.15)] hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div>
                    <div className="text-brand-cyan mb-3.5">
                      <Cpu className="w-5 h-5 drop-shadow-[0_0_6px_rgba(0,210,255,0.5)]" />
                    </div>
                    <h3 className="text-sm font-bold text-white mb-2 tracking-tight">AI &amp; Anomaly Detection</h3>
                    <p className="text-xs text-slate-300/85 leading-relaxed">
                      Detect unusual price behavior with explainable AI
                    </p>
                  </div>
                  <div className="flex justify-end pt-4 mt-auto">
                    <span className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center text-slate-400 group-hover:text-brand-cyan group-hover:border-cyan-400/60 group-hover:bg-cyan-500/10 text-xs transition-all">
                      →
                    </span>
                  </div>
                </Link>

                {/* Card 6: Reports & Downloads */}
                <Link
                  href="/downloads"
                  className="rounded-xl p-5 sm:p-6 flex flex-col justify-between group min-h-[175px] cursor-pointer bg-gradient-to-b from-[#081f38]/90 via-[#06182c]/90 to-[#040f1d]/90 border border-cyan-500/25 hover:border-cyan-400/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_4px_20px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_25px_rgba(0,210,255,0.15)] hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div>
                    <div className="text-brand-cyan mb-3.5">
                      <FileText className="w-5 h-5 drop-shadow-[0_0_6px_rgba(0,210,255,0.5)]" />
                    </div>
                    <h3 className="text-sm font-bold text-white mb-2 tracking-tight">Reports &amp; Downloads</h3>
                    <p className="text-xs text-slate-300/85 leading-relaxed">
                      Generate insights for policy, research and analysis
                    </p>
                  </div>
                  <div className="flex justify-end pt-4 mt-auto">
                    <span className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center text-slate-400 group-hover:text-brand-cyan group-hover:border-cyan-400/60 group-hover:bg-cyan-500/10 text-xs transition-all">
                      →
                    </span>
                  </div>
                </Link>
              </div>
            </section>
            {/* END: FeatureCardsGrid */}

            {/* BEGIN: Active Corridors Ticker */}
            <div className="w-full rounded-xl border border-white/10 bg-[#061525]/90 backdrop-blur-md py-3 px-4 sm:px-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-widest text-brand-cyan uppercase shrink-0 mr-4 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan animate-pulse shadow-[0_0_6px_#00D2FF]" />
                  ACTIVE CORRIDORS: %
                </span>
                <div className="overflow-hidden flex-1 relative">
                  <div className="ap-ticker-track">
                    {[...NAV_TICKER, ...NAV_TICKER, ...NAV_TICKER].map((t, i) => (
                      <span key={i} className="mx-5 inline-flex items-center gap-1.5 text-xs">
                        <span className="font-mono font-medium text-slate-300">{t.route}</span>
                        <span className={t.up ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                          {t.change}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* END: Active Corridors Ticker */}

            {/* BEGIN: BottomMissionBanner (Impact Banner) */}
            <footer className="w-full">
              <div className="rounded-2xl px-6 sm:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 border border-cyan-500/25 bg-gradient-to-r from-[#06182a]/95 via-[#08223c]/90 to-[#06182a]/95 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.12)]">
                {/* Text with Left Blue Border Accent */}
                <div className="flex items-center gap-4 text-left w-full sm:w-auto">
                  <div className="w-1.5 h-7 bg-brand-cyan rounded-full shadow-[0_0_10px_#00D2FF] shrink-0" />
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold tracking-[0.16em] uppercase text-white font-display">
                      A CREDIBLE TOMORROW THROUGH BETTER DATA
                    </h4>
                    <p className="text-xs text-slate-300/80 font-normal mt-0.5">
                      Empowering evidence-based policy with transparent airfare intelligence.
                    </p>
                  </div>
                </div>
                {/* Action Impact Button */}
                <Link
                  className="glow-cyan-btn inline-flex items-center justify-center px-8 py-2.5 rounded-full text-xs font-bold bg-gradient-to-r from-brand-cyan to-sky-400 text-brand-dark hover:brightness-110 active:scale-95 transition-all shadow-[0_0_20px_rgba(0,210,255,0.45)] self-end sm:self-center whitespace-nowrap cursor-pointer shrink-0"
                  href="/overview"
                >
                  Our Impact <span className="ml-1.5 font-black">→</span>
                </Link>
              </div>
            </footer>
            {/* END: BottomMissionBanner */}
          </div>
        </main>
        {/* END: HeroSection */}

        {/* BEGIN: Detailed In-Page Anchor Sections for Navigation */}
        <section id="about" className="py-16 px-4 sm:px-6 lg:px-8 border-t border-white/5 bg-[#030B17]/80">
          <div className="w-full max-w-[94vw] mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <div className="text-xs font-bold tracking-[0.2em] text-brand-cyan uppercase">
                THE VAYANTARA MISSION
              </div>
              <h2 className="text-2xl font-bold font-display text-white tracking-tight">
                Vayu (Air) + Antara (Interval / Variance)
              </h2>
              <p className="text-xs leading-relaxed text-slate-400">
                Airfares in India fluctuate dynamically across routes, advance booking windows, seasons, and market disruptions.
                VAYANTARA transforms millions of real flight fare quotes into a defensible, high-frequency price index to augment
                national economic statistics and policy formulation.
              </p>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-bold tracking-[0.2em] text-brand-cyan uppercase">
                PROVENANCE &amp; TRUST
              </div>
              <h3 className="text-lg font-bold text-white">Cryptographic Lineage</h3>
              <p className="text-xs leading-relaxed text-slate-400">
                Every fare quote collected from airline portals and OTAs is cryptographically hashed with SHA-256 and stored raw
                before normalization. Economists and auditors can inspect end-to-end provenance from raw HTTP response payload
                to published index point.
              </p>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-bold tracking-[0.2em] text-brand-cyan uppercase">
                METHODOLOGY &amp; RIGOR
              </div>
              <h3 className="text-lg font-bold text-white">Laspeyres Matched-Basket</h3>
              <p className="text-xs leading-relaxed text-slate-400">
                The national Airfare Price Index (APIx) is calculated using DGCA passenger traffic volume weights across high-density
                and regional connectivity corridors. Published indices are never synthesized from machine learning guesses.
              </p>
            </div>
          </div>
        </section>

        <section id="resources" className="py-8 px-4 sm:px-6 lg:px-8 border-t border-white/5 bg-[#020710] text-center text-xs text-slate-500">
          <div className="w-full max-w-[94vw] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
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
            <div className="flex items-center gap-6">
              <Link href="/login" className="hover:text-brand-cyan transition-colors">
                Sign In
              </Link>
              <Link href="/signup" className="hover:text-brand-cyan transition-colors">
                Request Access
              </Link>
              <Link href="/methodology" className="hover:text-brand-cyan transition-colors">
                Methodology Guide
              </Link>
              <Link href="/downloads" className="hover:text-brand-cyan transition-colors">
                Datasets &amp; Bulletins
              </Link>
            </div>
            <div>
              <span>© {new Date().getFullYear()} Ministry of Statistics &amp; Programme Implementation (MoSPI) · SIH26056</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
