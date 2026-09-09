"use client";

import React, { useEffect, useState } from "react";
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
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";

import { CountUp } from "@/components/landing/CountUp";
import { VayantaraLogo } from "@/components/ui/VayantaraLogo";
import { useAuth } from "@/lib/providers/AuthProvider";

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // If already signed in, skip the landing page.
  useEffect(() => {
    if (!loading && session) router.replace("/overview");
  }, [loading, session, router]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/overview?route=${encodeURIComponent(searchQuery.trim().toUpperCase())}`);
    } else {
      router.push("/overview");
    }
  };

  return (
    <div className="bg-[#030B17] text-slate-100 font-sans antialiased selection:bg-brand-cyan selection:text-black overflow-x-hidden min-h-screen relative flex flex-col justify-between">
      <div className="relative z-10 flex flex-col justify-between min-h-screen">
        {/* BEGIN: HeaderNav */}
        <header className="w-full px-6 lg:px-12 py-4 sm:py-5 flex items-center justify-between border-b border-white/10 bg-[#030B17]/70 backdrop-blur-md sticky top-0 z-50">
          {/* Brand Logo Container */}
          <Link className="flex items-center group cursor-pointer" href="/" title="VAYANTARA Home">
            <div className="relative h-8 sm:h-9 w-36 sm:w-44 transition-transform duration-200 group-hover:scale-105">
              <Image
                src="/top left.png"
                alt="VAYANTARA"
                fill
                priority
                sizes="(max-width: 640px) 150px, 180px"
                className="object-contain object-left filter drop-shadow-[0_0_1px_rgba(255,255,255,0.9)] drop-shadow-[0_0_12px_rgba(0,210,255,0.7)] brightness-125 contrast-110"
              />
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-7 text-xs font-medium tracking-wide">
            <Link className="text-white relative py-1.5 font-semibold" href="/">
              Home
              <span className="absolute bottom-0 left-0 w-full h-[2.5px] bg-brand-cyan rounded-full shadow-[0_0_8px_#00D2FF]" />
            </Link>
            <a className="text-slate-300 hover:text-white transition-colors duration-150" href="#about">
              About
            </a>
            <a className="text-slate-300 hover:text-white transition-colors duration-150" href="#features">
              Features
            </a>
            <Link className="text-slate-300 hover:text-white transition-colors duration-150" href="/methodology">
              Data &amp; Methodology
            </Link>
            <Link className="text-slate-300 hover:text-white transition-colors duration-150" href="/overview">
              Dashboard
            </Link>
            <Link className="text-slate-300 hover:text-white transition-colors duration-150" href="/downloads">
              Reports
            </Link>
            <a className="text-slate-300 hover:text-white transition-colors duration-150" href="#resources">
              Resources
            </a>
          </nav>

          {/* Action Items (Search & Get Access) */}
          <div className="flex items-center space-x-4">
            <button
              aria-label="Search routes and intelligence"
              className="p-2 text-slate-300 hover:text-brand-cyan transition-colors cursor-pointer"
              type="button"
              onClick={() => setSearchOpen(!searchOpen)}
            >
              <Search className="w-4 h-4" />
            </button>
            <Link
              className="glow-cyan-btn inline-flex items-center justify-center px-5 py-2 text-xs font-semibold rounded-full bg-gradient-to-r from-brand-cyan to-sky-400 text-brand-dark hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              href="/signup"
            >
              Get Access <span className="ml-1.5 font-bold">→</span>
            </Link>
          </div>
        </header>
        {/* END: HeaderNav */}

        {/* Quick Search Popover */}
        {searchOpen && (
          <div className="fixed top-20 inset-x-0 z-50 flex justify-center px-4">
            <form
              onSubmit={handleSearchSubmit}
              className="w-full max-w-lg glass-panel p-3 rounded-xl flex items-center gap-2 shadow-2xl border border-brand-cyan/30"
            >
              <Search className="w-4 h-4 text-brand-cyan ml-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search route (e.g. DEL-BOM), city-pair, or index..."
                className="flex-1 bg-transparent border-none text-white text-xs placeholder:text-slate-400 focus:outline-none"
                autoFocus
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-brand-cyan text-brand-dark text-xs font-bold hover:brightness-110"
              >
                Go
              </button>
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="text-xs text-slate-400 hover:text-white px-1"
              >
                ✕
              </button>
            </form>
          </div>
        )}

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
            <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-[#030B17]/85 via-[#030B17]/40 to-transparent" />

            {/* Subtle Side Vignettes */}
            <div className="absolute inset-y-0 left-0 w-16 sm:w-28 bg-gradient-to-r from-[#030B17]/70 to-transparent" />
            <div className="absolute inset-y-0 right-0 w-16 sm:w-28 bg-gradient-to-l from-[#030B17]/70 to-transparent" />

            {/* Clean Bottom Transition into Dark Canvas */}
            <div className="absolute bottom-0 inset-x-0 h-28 sm:h-36 bg-gradient-to-t from-[#030B17] via-[#030B17]/85 to-transparent" />
          </div>

          {/* Hero Content Container */}
          <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12">
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
                <div className="relative w-full max-w-[340px] sm:max-w-[440px] lg:max-w-[520px] h-[150px] sm:h-[195px] lg:h-[230px] mb-2 group cursor-pointer">
                  {/* Dedicated local aura behind the artwork */}
                  <div className="absolute inset-0 -m-4 bg-gradient-to-b from-sky-400/35 via-cyan-400/25 to-transparent rounded-full blur-2xl pointer-events-none" />
                  <Image
                    src="/Hero middle.png"
                    alt="VAYANTARA — Real-Time Airfare Intelligence & Price Index for India"
                    fill
                    priority
                    sizes="(max-width: 640px) 340px, (max-width: 1024px) 440px, 520px"
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

        {/* Main Content Area: Ticker, Features, Banner */}
        <main className="flex-grow flex flex-col justify-center px-6 lg:px-12 pt-2 pb-6">

          {/* BEGIN: LiveMetricsTicker */}
          <section aria-label="Real-Time Metrics" className="w-full max-w-7xl mx-auto my-3">
            <div className="glass-panel rounded-2xl px-6 py-3.5 flex flex-wrap lg:flex-nowrap items-center justify-between gap-6">
              {/* Metric 1: National APIx */}
              <div className="flex items-center gap-3.5 min-w-[170px]">
                <div className="text-brand-cyan">
                  <svg className="w-6 h-6 transform -rotate-45" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CountUp
                      end={108.43}
                      decimals={2}
                      className="text-lg font-bold tracking-tight text-white font-display tabular-nums"
                    />
                    <span className="text-[11px] font-semibold text-emerald-400 flex items-center">↑ +4.2%</span>
                  </div>
                  <p className="text-[10px] tracking-wider text-slate-400 uppercase font-medium">NATIONAL APIx</p>
                </div>
              </div>

              <div className="hidden lg:block w-[1px] h-8 bg-slate-700/60" />

              {/* Metric 2: Quotes / 24H */}
              <div className="flex items-center gap-3.5 min-w-[170px]">
                <div className="text-brand-cyan">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <CountUp
                    end={28452}
                    className="text-lg font-bold tracking-tight text-white font-display tabular-nums"
                  />
                  <p className="text-[10px] tracking-wider text-slate-400 uppercase font-medium">QUOTES / 24H</p>
                </div>
              </div>

              <div className="hidden lg:block w-[1px] h-8 bg-slate-700/60" />

              {/* Metric 3: Data Confidence */}
              <div className="flex items-center gap-3.5 min-w-[170px]">
                <div className="text-brand-cyan">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div>
                  <CountUp
                    end={94.8}
                    decimals={1}
                    suffix="%"
                    className="text-lg font-bold tracking-tight text-white font-display tabular-nums"
                  />
                  <p className="text-[10px] tracking-wider text-slate-400 uppercase font-medium">DATA CONFIDENCE</p>
                </div>
              </div>

              <div className="hidden lg:block w-[1px] h-8 bg-slate-700/60" />

              {/* Metric 4: Routes Tracked */}
              <div className="flex items-center gap-3.5 min-w-[150px]">
                <div className="text-brand-cyan">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <CountUp
                    end={81}
                    className="text-lg font-bold tracking-tight text-white font-display tabular-nums"
                  />
                  <p className="text-[10px] tracking-wider text-slate-400 uppercase font-medium">ROUTES TRACKED</p>
                </div>
              </div>

              <div className="hidden lg:block w-[1px] h-8 bg-slate-700/60" />

              {/* Status Indicator Right Side */}
              <div className="flex items-center gap-2.5 text-[10px] tracking-widest uppercase font-semibold text-slate-300">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
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

          {/* BEGIN: FeatureCardsGrid */}
          <section id="features" aria-label="Core Capabilities" className="w-full max-w-7xl mx-auto my-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
              {/* Card 1: Airfare Price Index */}
              <Link
                href="/apix"
                className="glass-card rounded-xl p-4 flex flex-col justify-between group min-h-[140px] cursor-pointer"
              >
                <div>
                  <div className="text-brand-cyan mb-2.5">
                    <LineChart className="w-5 h-5" />
                  </div>
                  <h3 className="text-xs font-bold text-white mb-1 tracking-tight">Airfare Price Index</h3>
                  <p className="text-[11px] text-slate-400 leading-snug">Track real-time and historical price movements</p>
                </div>
                <div className="flex justify-end pt-3">
                  <span className="w-5 h-5 rounded-full border border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-brand-cyan group-hover:border-brand-cyan text-[10px] transition-colors">
                    →
                  </span>
                </div>
              </Link>

              {/* Card 2: Route Intelligence */}
              <Link
                href="/routes"
                className="glass-card rounded-xl p-4 flex flex-col justify-between group min-h-[140px] cursor-pointer"
              >
                <div>
                  <div className="text-brand-cyan mb-2.5">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <h3 className="text-xs font-bold text-white mb-1 tracking-tight">Route Intelligence</h3>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Compare fares across routes, airlines and time windows
                  </p>
                </div>
                <div className="flex justify-end pt-3">
                  <span className="w-5 h-5 rounded-full border border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-brand-cyan group-hover:border-brand-cyan text-[10px] transition-colors">
                    →
                  </span>
                </div>
              </Link>

              {/* Card 3: Booking Window Analysis */}
              <Link
                href="/booking-windows"
                className="glass-card rounded-xl p-4 flex flex-col justify-between group min-h-[140px] cursor-pointer"
              >
                <div>
                  <div className="text-brand-cyan mb-2.5">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <h3 className="text-xs font-bold text-white mb-1 tracking-tight">Booking Window Analysis</h3>
                  <p className="text-[11px] text-slate-400 leading-snug">Understand how fares change over time</p>
                </div>
                <div className="flex justify-end pt-3">
                  <span className="w-5 h-5 rounded-full border border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-brand-cyan group-hover:border-brand-cyan text-[10px] transition-colors">
                    →
                  </span>
                </div>
              </Link>

              {/* Card 4: Data & Provenance */}
              <Link
                href="/ingestion"
                className="glass-card rounded-xl p-4 flex flex-col justify-between group min-h-[140px] cursor-pointer"
              >
                <div>
                  <div className="text-brand-cyan mb-2.5">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <h3 className="text-xs font-bold text-white mb-1 tracking-tight">Data &amp; Provenance</h3>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Transparent, auditable and verifiable data pipeline
                  </p>
                </div>
                <div className="flex justify-end pt-3">
                  <span className="w-5 h-5 rounded-full border border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-brand-cyan group-hover:border-brand-cyan text-[10px] transition-colors">
                    →
                  </span>
                </div>
              </Link>

              {/* Card 5: AI & Anomaly Detection */}
              <Link
                href="/anomalies"
                className="glass-card rounded-xl p-4 flex flex-col justify-between group min-h-[140px] cursor-pointer"
              >
                <div>
                  <div className="text-brand-cyan mb-2.5">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <h3 className="text-xs font-bold text-white mb-1 tracking-tight">AI &amp; Anomaly Detection</h3>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Detect unusual price behavior with explainable AI
                  </p>
                </div>
                <div className="flex justify-end pt-3">
                  <span className="w-5 h-5 rounded-full border border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-brand-cyan group-hover:border-brand-cyan text-[10px] transition-colors">
                    →
                  </span>
                </div>
              </Link>

              {/* Card 6: Reports & Downloads */}
              <Link
                href="/downloads"
                className="glass-card rounded-xl p-4 flex flex-col justify-between group min-h-[140px] cursor-pointer"
              >
                <div>
                  <div className="text-brand-cyan mb-2.5">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h3 className="text-xs font-bold text-white mb-1 tracking-tight">Reports &amp; Downloads</h3>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Generate insights for policy, research and analysis
                  </p>
                </div>
                <div className="flex justify-end pt-3">
                  <span className="w-5 h-5 rounded-full border border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-brand-cyan group-hover:border-brand-cyan text-[10px] transition-colors">
                    →
                  </span>
                </div>
              </Link>
            </div>
          </section>
          {/* END: FeatureCardsGrid */}

          {/* Live route ticker bar */}
          <div className="w-full max-w-7xl mx-auto my-3 overflow-hidden rounded-xl border border-white/5 bg-[#061325]/60 backdrop-blur-sm py-2 px-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-widest text-brand-cyan uppercase shrink-0 mr-4 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan animate-pulse" />
                ACTIVE CORRIDORS:
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

          {/* BEGIN: BottomMissionBanner */}
          <footer className="w-full max-w-7xl mx-auto my-3">
            <div className="glass-panel rounded-xl px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Text with Left Blue Border Accent */}
              <div className="flex items-center gap-4 text-left w-full sm:w-auto">
                <div className="w-1.5 h-9 bg-brand-cyan rounded-full shadow-[0_0_10px_#00D2FF]" />
                <div>
                  <h4 className="text-xs font-bold tracking-[0.16em] uppercase text-white font-display">
                    A CREDIBLE TOMORROW THROUGH BETTER DATA
                  </h4>
                  <p className="text-xs text-slate-400 font-normal">
                    Empowering evidence-based policy with transparent airfare intelligence.
                  </p>
                </div>
              </div>
              {/* Action Impact Button */}
              <Link
                className="glow-cyan-btn inline-flex items-center justify-center px-6 py-2 rounded-full text-xs font-bold bg-gradient-to-r from-brand-cyan to-sky-400 text-brand-dark hover:brightness-110 active:scale-95 transition-all self-end sm:self-center whitespace-nowrap cursor-pointer"
                href="/overview"
              >
                Our Impact <span className="ml-1.5">→</span>
              </Link>
            </div>
          </footer>
          {/* END: BottomMissionBanner */}
        </main>
        {/* END: HeroSection */}

        {/* BEGIN: Detailed In-Page Anchor Sections for Navigation */}
        <section id="about" className="py-16 px-6 lg:px-12 border-t border-white/5 bg-[#030B17]/80">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
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

        <section id="resources" className="py-8 px-6 lg:px-12 border-t border-white/5 bg-[#020710] text-center text-xs text-slate-500">
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
