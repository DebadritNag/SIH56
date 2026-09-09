"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { VayantaraLogo } from "@/components/ui/VayantaraLogo";

/**
 * Split-screen auth shell: a dynamic navy brand panel (left) and the form (right).
 * Shared by /login and /signup for a consistent, government-grade look.
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
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#030B17]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden lg:block">
        <div className="ap-grid-bg absolute inset-0 opacity-50" aria-hidden />
        <div
          className="absolute -left-20 top-1/3 h-[380px] w-[520px] rounded-full bg-brand-cyan/20 blur-[120px]"
          aria-hidden
        />
        <div className="relative flex h-full flex-col justify-between p-10">
          <Link href="/" className="inline-flex items-center gap-3 cursor-pointer w-fit">
            <VayantaraLogo variant="standard" size="sm" />
            <div className="leading-tight">
              <span className="block text-base font-bold tracking-[0.16em] text-white font-display uppercase">
                VAYANTARA
              </span>
              <span className="block text-[10px] text-brand-cyan uppercase tracking-wider font-semibold">
                Airfare Price Index · India
              </span>
            </div>
          </Link>

          <div className="ap-fade-up max-w-md">
            <h2 className="text-3xl font-bold leading-tight text-white font-display">
              Real-time airfare intelligence for national statistics
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-300">
              Immutable provenance, matched-basket APIx, and explainable anomaly QA —
              built for MoSPI and RBI economists.
            </p>
            <div className="mt-8 space-y-3">
              {[
                "SHA-256 provenance on every observation",
                "Official index from validated fares only",
                "Role-based, cryptographically logged access",
              ].map((t) => (
                <div key={t} className="flex items-center gap-2.5 text-sm text-slate-300">
                  <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                  {t}
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-500">
            © Ministry of Statistics &amp; Programme Implementation · SIH26056
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          {/* mobile brand */}
          <Link href="/" className="mb-8 inline-flex items-center gap-2.5 lg:hidden cursor-pointer">
            <VayantaraLogo variant="standard" size="xs" />
            <span className="text-sm font-bold tracking-[0.16em] text-white font-display uppercase">
              VAYANTARA
            </span>
          </Link>

          <h1 className="text-2xl font-bold text-white font-display">{title}</h1>
          <p className="mt-1.5 text-sm text-slate-400">{subtitle}</p>

          <div className="mt-8">{children}</div>

          {footer && <div className="mt-6 text-center text-sm text-slate-400">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
