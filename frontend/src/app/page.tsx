"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Database,
  Fingerprint,
  Gauge,
  LineChart,
  Lock,
  Radio,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { CountUp } from "@/components/landing/CountUp";
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

const FEATURES = [
  {
    icon: Database,
    title: "Immutable Provenance",
    body: "Every quote is SHA-256 hashed and stored raw before parsing. Full lineage from byte-stream to published index — auditable end to end.",
  },
  {
    icon: LineChart,
    title: "Matched-Basket APIx",
    body: "A Laspeyres-type national index computed strictly from validated observed fares across routes and booking windows — never from ML predictions.",
  },
  {
    icon: ShieldCheck,
    title: "FareGuard + PriceGuard",
    body: "XGBoost expected-fare benchmarking and Isolation Forest anomaly detection, with gated SHAP attribution and cross-source agreement checks.",
  },
  {
    icon: Radio,
    title: "Real-Time Operations",
    body: "Live collection, pipeline, and anomaly state stream to the control room over Supabase Realtime — no page reloads, FastAPI stays source of truth.",
  },
  {
    icon: Gauge,
    title: "Coverage Quality Score",
    body: "Q = 0.40·Cr + 0.25·Cs + 0.20·F + 0.15·V. Every published index carries a transparent statistical trust score.",
  },
  {
    icon: Fingerprint,
    title: "Government-Grade Governance",
    body: "Role-based access (viewer / analyst / admin), cryptographically logged provenance lookups, and RLS-protected data access.",
  },
];

const PIPELINE = ["Collect", "Normalize", "Validate", "Deduplicate", "FareGuard", "PriceGuard", "APIx"];

export default function LandingPage() {
  const router = useRouter();
  const { session, loading } = useAuth();

  // If already signed in, skip the landing page.
  useEffect(() => {
    if (!loading && session) router.replace("/overview");
  }, [loading, session, router]);

  return (
    <div className="min-h-screen bg-[#050B18] text-slate-100 overflow-x-hidden">
      {/* ============ NAV ============ */}
      <header className="fixed top-0 inset-x-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 mt-4">
          <nav className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0A1428]/80 backdrop-blur px-4 py-3 shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-700 shadow-md">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <div className="leading-tight">
                <span className="block text-sm font-bold tracking-tight text-white">AirPulse</span>
                <span className="block text-[10px] text-slate-400">Airfare Price Index · India</span>
              </div>
            </div>
            <div className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
              <a href="#platform" className="hover:text-white transition-colors">Platform</a>
              <a href="#methodology" className="hover:text-white transition-colors">Methodology</a>
              <a href="#trust" className="hover:text-white transition-colors">Trust</a>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-200 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3.5 py-1.5 text-sm font-semibold text-white shadow-md hover:bg-sky-400 transition-colors cursor-pointer"
              >
                Request access
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section className="relative pt-36 pb-20 sm:pt-44">
        {/* animated grid + glow */}
        <div className="pointer-events-none absolute inset-0 ap-grid-bg opacity-60" aria-hidden />
        <div
          className="pointer-events-none absolute left-1/2 top-24 -z-0 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-sky-500/20 blur-[120px]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Left copy */}
            <div>
              <div className="ap-fade-up inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-300">
                <Sparkles className="h-3.5 w-3.5" />
                SIH26056 · MoSPI × RBI CPI Augmentation
              </div>
              <h1 className="ap-fade-up ap-delay-1 mt-5 text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                The real-time
                <span className="bg-gradient-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent"> airfare price index </span>
                for India
              </h1>
              <p className="ap-fade-up ap-delay-2 mt-5 max-w-xl text-base leading-relaxed text-slate-300">
                AirPulse automatically collects domestic airfares from airline and OTA portals,
                preserves immutable cryptographic provenance, and computes a transparent,
                high-frequency price index to augment the Consumer Price Index.
              </p>
              <div className="ap-fade-up ap-delay-3 mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/20 hover:bg-sky-400 transition-colors cursor-pointer"
                >
                  Request analyst access
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <Lock className="h-4 w-4" />
                  Enter portal
                </Link>
              </div>
              <div className="ap-fade-up ap-delay-4 mt-6 flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Authorized government economic analysts only · provenance cryptographically logged
              </div>
            </div>

            {/* Right: live APIx card */}
            <div className="ap-fade-in ap-delay-2">
              <div className="ap-float relative rounded-2xl border border-white/10 bg-gradient-to-b from-[#0C1A33] to-[#081426] p-6 shadow-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    National APIx
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                    <span className="ap-pulse-ring h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Live
                  </span>
                </div>
                <div className="mt-3 flex items-end gap-3">
                  <CountUp
                    end={108.43}
                    decimals={2}
                    className="text-5xl font-bold tabular-nums text-white"
                  />
                  <span className="mb-1 inline-flex items-center gap-1 text-sm font-semibold text-emerald-400">
                    <TrendingUp className="h-4 w-4" />
                    +4.82%
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">Base period: Aug 2026 = 100.0 · Laspeyres route basket</p>

                {/* mini sparkline (pure SVG, deterministic) */}
                <div className="mt-5 rounded-lg border border-white/5 bg-black/20 p-3">
                  <svg viewBox="0 0 320 80" className="h-20 w-full" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="apx" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <polyline
                      fill="none"
                      stroke="#38BDF8"
                      strokeWidth="2"
                      points="0,64 40,60 80,54 120,40 160,44 200,30 240,24 280,18 320,10"
                    />
                    <polygon
                      fill="url(#apx)"
                      points="0,64 40,60 80,54 120,40 160,44 200,30 240,24 280,18 320,10 320,80 0,80"
                    />
                  </svg>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-lg font-bold tabular-nums text-white">
                      <CountUp end={28452} />
                    </div>
                    <div className="text-[10px] text-slate-400">quotes / 24h</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold tabular-nums text-white">
                      <CountUp end={94.8} decimals={1} suffix="%" />
                    </div>
                    <div className="text-[10px] text-slate-400">data confidence</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold tabular-nums text-white">
                      <CountUp end={81} />
                    </div>
                    <div className="text-[10px] text-slate-400">routes</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* live route ticker */}
        <div className="relative mt-14 overflow-hidden border-y border-white/10 bg-[#0A1428]/60 py-3">
          <div className="ap-ticker-track">
            {[...NAV_TICKER, ...NAV_TICKER].map((t, i) => (
              <span key={i} className="mx-6 inline-flex items-center gap-2 text-sm">
                <span className="font-mono font-semibold text-slate-200">{t.route}</span>
                <span className={t.up ? "text-emerald-400" : "text-rose-400"}>{t.change}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section id="platform" className="relative py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              A statistical intelligence platform, not a booking app
            </h2>
            <p className="mt-4 text-slate-300">
              Built for MoSPI analysts, RBI economists, and national researchers who need
              defensible, high-frequency airfare inflation data.
            </p>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-xl border border-white/10 bg-[#0A1428]/60 p-6 transition-colors hover:border-sky-400/40 hover:bg-[#0C1A33]"
              >
                <div className="grid h-11 w-11 place-items-center rounded-lg bg-sky-500/10 text-sky-400 ring-1 ring-sky-400/20 transition-colors group-hover:bg-sky-500/20">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ METHODOLOGY / PIPELINE ============ */}
      <section id="methodology" className="relative py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#0A1428] to-[#050B18] p-8 sm:p-12">
            <div className="mx-auto max-w-2xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
                <BarChart3 className="h-3.5 w-3.5 text-sky-400" />
                Transparent, decoupled pipeline
              </span>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-white">
                From raw quote to published index
              </h2>
              <p className="mt-3 text-slate-400">
                Statistics and ML are decoupled: if the ML QA path errors, the official APIx
                still computes from validated observed fares.
              </p>
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
              {PIPELINE.map((step, i) => (
                <React.Fragment key={step}>
                  <div className="rounded-lg border border-white/10 bg-[#0C1A33] px-4 py-2 text-sm font-semibold text-slate-200">
                    {step}
                  </div>
                  {i < PIPELINE.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-slate-600" aria-hidden />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ TRUST STRIP ============ */}
      <section id="trust" className="relative py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-6 rounded-2xl border border-white/10 bg-[#0A1428]/60 p-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Route basket coverage", value: 96.2, suffix: "%" },
              { label: "Source coverage", value: 100, suffix: "%" },
              { label: "Validation pass rate", value: 97.4, suffix: "%" },
              { label: "Statistical trust score", value: 94.8, suffix: "/100" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-bold tabular-nums text-white">
                  <CountUp end={s.value} decimals={1} suffix={s.suffix} />
                </div>
                <div className="mt-1 text-xs text-slate-400">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="relative py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Enter the AirPulse intelligence portal
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-300">
            Access is restricted to authorized government economic analysts. New users are
            provisioned with viewer clearance and elevated by an administrator.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/20 hover:bg-sky-400 transition-colors cursor-pointer"
            >
              Request access
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Activity className="h-4 w-4 text-sky-400" />
            AirPulse · Ministry of Statistics &amp; Programme Implementation
          </div>
          <p className="text-xs text-slate-500">
            Airfare statistical intelligence for CPI augmentation · SIH26056
          </p>
        </div>
      </footer>
    </div>
  );
}
