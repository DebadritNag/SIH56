"use client";

/**
 * PublicNavbar — shared header used on every public-facing page (Home, About).
 *
 * Items: Home · About · Get Access
 * Same width, height, spacing, and logo on all public pages.
 * Pass `active="home"` or `active="about"` to highlight the current page.
 */

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";

type ActivePage = "home" | "about";

interface PublicNavbarProps {
  active: ActivePage;
}

export function PublicNavbar({ active }: PublicNavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { label: string; href: string; id: ActivePage }[] = [
    { label: "Home",  href: "/",      id: "home"  },
    { label: "About", href: "/about", id: "about" },
  ];

  return (
    <header
      className="w-full border-b border-white/10 backdrop-blur-md sticky top-0 z-50 transition-colors duration-200"
      style={{
        background: "linear-gradient(180deg, rgba(6, 21, 34, 0.98) 0%, rgba(4, 17, 29, 0.96) 100%)",
      }}
    >
      {/* ── Container — identical to Home: max-w-[94vw] mx-auto ── */}
      <div className="w-full max-w-[94vw] mx-auto px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4 flex items-center justify-between">

        {/* Logo */}
        <Link className="flex items-center group cursor-pointer shrink-0" href="/" title="VAYANTARA Home">
          <div className="relative flex items-center justify-center py-1">
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

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center space-x-7 text-xs font-medium tracking-wide">
          {navItems.map((item) =>
            active === item.id ? (
              <Link key={item.id} className="text-white relative py-1.5 font-semibold" href={item.href}>
                {item.label}
                <span className="absolute bottom-0 left-0 w-full h-[2.5px] bg-brand-cyan rounded-full shadow-[0_0_8px_#00D2FF]" />
              </Link>
            ) : (
              <Link
                key={item.id}
                className="text-slate-300 hover:text-white transition-colors duration-150"
                href={item.href}
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>

        {/* Right-side actions */}
        <div className="flex items-center gap-3">
          <Link
            className="glow-cyan-btn inline-flex items-center justify-center px-5 py-2 text-xs font-semibold rounded-full bg-gradient-to-r from-brand-cyan to-sky-400 text-brand-dark hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            href="/signup"
          >
            Get Access <span className="ml-1.5 font-bold">→</span>
          </Link>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="md:hidden p-2 text-slate-300 hover:text-white cursor-pointer"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#050c18] border-b border-slate-800 px-4 pt-2 pb-6 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`block py-2 text-sm border-b border-slate-800/60 last:border-0 transition-colors ${
                active === item.id
                  ? "text-brand-cyan font-semibold"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/signup"
            onClick={() => setMobileMenuOpen(false)}
            className="block pt-3 text-sm font-semibold text-brand-cyan hover:text-white transition-colors"
          >
            Get Access →
          </Link>
        </div>
      )}
    </header>
  );
}
