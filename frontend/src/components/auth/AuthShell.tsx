"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Activity, BarChart3, Database, ShieldCheck } from "lucide-react";

/**
 * Institutional AuthShell:
 * Implements the Stitch layout with dynamic atmospheric background,
 * full-width header with /top left.png branding and trust pillars,
 * left authority column with 4 integrity badges and floating APIx sparkline card,
 * right glass-card form container, and bottom metrics strip.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen text-[#e2e8f0] selection:bg-cyan-500 selection:text-black overflow-x-hidden font-sans">
      {/* Primary Background Artwork - /auth-back.png */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        <Image
          src="/auth-back.png"
          alt="VAYANTARA Background"
          fill
          priority
          unoptimized
          className="object-cover object-center"
        />
        {/* Soft, light vignette overlay (10-15% max) to ensure edge grounding without dulling artwork colors */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#030A16]/30 via-transparent to-[#030A16]/20" />
      </div>

      {/* Master Container */}
      <div className="relative z-10 flex flex-col justify-between min-h-screen px-4 py-6 sm:px-8 md:px-12 lg:px-16 max-w-[1720px] mx-auto">
        {/* Header Navigation Bar */}
        <header className="flex items-center justify-between pb-4 pt-2">
          {/* Logo Branding */}
          <Link href="/" className="flex items-center group cursor-pointer shrink-0" title="VAYANTARA Home">
            <div className="relative flex items-center justify-center py-1">
              {/* Subtle localized radial glow behind the logo only */}
              <div
                aria-hidden="true"
                className="absolute inset-0 -inset-x-5 -inset-y-3 rounded-full pointer-events-none"
                style={{
                  background:
                    "radial-gradient(ellipse at 28% 50%, rgba(0, 190, 255, 0.22) 0%, rgba(2, 132, 199, 0.10) 45%, transparent 72%)",
                }}
              />
              <Image
                src="/top left.png"
                alt="VAYANTARA"
                width={180}
                height={60}
                priority
                unoptimized
                className="w-[150px] sm:w-[175px] h-auto object-contain relative z-10 filter brightness-[1.22] contrast-[1.15] saturate-[1.15] drop-shadow-[0_0_1px_rgba(255,255,255,0.35)] transition-transform duration-200 group-hover:scale-[1.02]"
              />
            </div>
          </Link>

          {/* Top Right Institutional Trust Metrics */}
          <nav className="hidden md:flex items-center space-x-4 lg:space-x-6 text-[11px] tracking-widest font-semibold text-slate-400 uppercase">
            <span className="hover:text-white transition-colors">TRUST</span>
            <span className="text-slate-600">|</span>
            <span className="hover:text-white transition-colors">RESILIENCE</span>
            <span className="text-slate-600">|</span>
            <span className="hover:text-white transition-colors">INTELLIGENCE</span>
            <span className="text-slate-600">|</span>
            <span className="hover:text-white transition-colors">STATISTICAL INTEGRITY</span>
          </nav>
        </header>

        {/* Main Showcase Body */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center my-auto py-8">
          {/* Left Column - Context & Authority */}
          <div className="lg:col-span-7 flex flex-col justify-center space-y-7 relative">
            {/* Eyebrow Subheader */}
            <div>
              <p className="text-xs md:text-sm font-semibold tracking-[0.25em] text-slate-400 uppercase">
                DATA TODAY. A MORE CONNECTED TOMORROW.
              </p>
            </div>

            {/* Headline */}
            <div className="max-w-xl">
              <h2 className="text-4xl md:text-5xl lg:text-[52px] font-extrabold text-white leading-[1.15] tracking-tight font-sans">
                Real-time airfare intelligence for{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-cyan-300 to-cyan-400">
                  national statistics.
                </span>
              </h2>
            </div>

            {/* Summary Paragraph */}
            <p className="text-slate-300/90 text-sm md:text-base leading-relaxed max-w-lg font-normal">
              Immutable provenance, matched-basket APIs, and explainable anomaly detection — built for MoSPI and RBI economists.
            </p>

            {/* 4 Bullet Integrity Points with Circular Icons */}
            <div className="space-y-4 pt-1 max-w-md">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-sky-950/80 border border-sky-400/40 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(0,180,255,0.2)]">
                  <BarChart3 className="w-5 h-5 text-cyan-400" />
                </div>
                <span className="text-sm font-medium text-slate-200">SHA-256 provenance on every observation</span>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-sky-950/80 border border-sky-400/40 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(0,180,255,0.2)]">
                  <ShieldCheck className="w-5 h-5 text-cyan-400" />
                </div>
                <span className="text-sm font-medium text-slate-200">Official index from validated fares only</span>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-sky-950/80 border border-sky-400/40 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(0,180,255,0.2)]">
                  <Database className="w-5 h-5 text-cyan-400" />
                </div>
                <span className="text-sm font-medium text-slate-200">Role-based, cryptographically logged access</span>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-sky-950/80 border border-sky-400/40 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(0,180,255,0.2)]">
                  <Activity className="w-5 h-5 text-cyan-400" />
                </div>
                <span className="text-sm font-medium text-slate-200">Built for policy, research and economic decision-making</span>
              </div>
            </div>


          </div>

          {/* Right Column - Request Access / Login Glass Card Form */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <section className="w-full max-w-[480px] rounded-2xl p-7 md:p-9 shadow-2xl border border-sky-400/30 bg-[#07192f]/80 backdrop-blur-xl">
              {/* Card Header */}
              <div className="mb-6">
                <h3 className="text-2xl md:text-3xl font-bold text-white tracking-tight">{title}</h3>
                <p className="text-xs md:text-sm text-slate-300 mt-1.5 font-normal">{subtitle}</p>
              </div>

              {/* Form Content */}
              <div>{children}</div>

              {/* Redirection Footer */}
              {footer && <div className="text-center pt-3 text-xs text-slate-300">{footer}</div>}

              {/* Trust Badge Subtitle Footer */}
              <div className="pt-4 border-t border-slate-800/80 mt-5 text-center">
                <p className="text-[9px] tracking-widest text-slate-400 uppercase font-semibold">
                  SECURE <span className="mx-1.5">•</span> GOVERNMENT GRADE <span className="mx-1.5">•</span> AUDIT READY
                </p>
              </div>
            </section>
          </div>
        </main>

        {/* Footer Metrics & Tagline */}
        <footer className="pt-6 pb-2 border-t border-slate-800/60 flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
          {/* Metrics Strip */}
          <div className="flex flex-wrap items-center gap-8 md:gap-14">
            <div>
              <h4 className="text-xl md:text-2xl font-extrabold text-white tracking-tight leading-none">1000+</h4>
              <p className="text-[11px] font-medium text-slate-400 mt-1">Routes Monitored</p>
            </div>
            <div className="hidden sm:block h-7 w-[1px] bg-slate-700/60" />
            <div>
              <h4 className="text-xl md:text-2xl font-extrabold text-white tracking-tight leading-none">Multiple</h4>
              <p className="text-[11px] font-medium text-slate-400 mt-1">Data Sources (OTA + Airlines)</p>
            </div>
            <div className="hidden sm:block h-7 w-[1px] bg-slate-700/60" />
            <div>
              <h4 className="text-xl md:text-2xl font-extrabold text-white tracking-tight leading-none">Real-Time</h4>
              <p className="text-[11px] font-medium text-slate-400 mt-1">Airfare Intelligence</p>
            </div>
          </div>

          {/* Watermark / Slogan */}
          <div className="text-left md:text-right">
            <p className="text-[10px] md:text-[11px] font-semibold tracking-widest text-slate-400 uppercase leading-relaxed">
              FROM<br className="hidden md:block" />
              AIRFARE MOVEMENT<br />
              TO ECONOMIC<br className="hidden md:block" />
              INTELLIGENCE
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
