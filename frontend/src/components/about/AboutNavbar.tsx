"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, Menu, X } from "lucide-react";

export function AboutNavbar() {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/overview?route=${encodeURIComponent(searchQuery.trim().toUpperCase())}`);
    } else {
      router.push("/overview");
    }
    setSearchOpen(false);
  };

  return (
    <header
      className="w-full border-b border-white/10 backdrop-blur-md sticky top-0 z-50 transition-colors duration-200"
      style={{
        background: "linear-gradient(180deg, rgba(6, 21, 34, 0.98) 0%, rgba(4, 17, 29, 0.96) 100%)",
      }}
    >
      <div className="w-full px-4 sm:px-6 md:px-8 lg:px-[6vw] xl:px-[7vw] py-3.5 sm:py-4 flex items-center justify-between gap-6">
        {/* Logo - Anchoring Top-Left */}
        <Link href="/" className="flex items-center group cursor-pointer shrink-0" title="VAYANTARA Home">
          <div className="relative flex items-center justify-center py-1">
            {/* Subtle localized radial glow behind the logo */}
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
              width={220}
              height={64}
              priority
              unoptimized
              className="w-[170px] sm:w-[195px] lg:w-[220px] h-auto object-contain relative z-10 filter brightness-[1.22] contrast-[1.15] saturate-[1.15] drop-shadow-[0_0_1px_rgba(255,255,255,0.35)] transition-transform duration-200 group-hover:scale-[1.02]"
              style={{ height: "auto" }}
            />
          </div>
        </Link>

        {/* Desktop Navigation Links - Centered */}
        <nav className="hidden md:flex items-center space-x-7 lg:space-x-8 text-xs font-medium tracking-wide">
          <Link className="text-slate-300 hover:text-white transition-colors duration-150" href="/">
            Home
          </Link>
          <Link className="text-white relative py-1.5 font-semibold" href="/about">
            About
            <span className="absolute bottom-0 left-0 w-full h-[2.5px] bg-brand-cyan rounded-full shadow-[0_0_8px_#00D2FF]" />
          </Link>
          <Link className="text-slate-300 hover:text-white transition-colors duration-150" href="/#features">
            Features
          </Link>
          <Link className="text-slate-300 hover:text-white transition-colors duration-150" href="/methodology">
            Data &amp; Methodology
          </Link>
          <Link className="text-slate-300 hover:text-white transition-colors duration-150" href="/overview">
            Dashboard
          </Link>
          <Link className="text-slate-300 hover:text-white transition-colors duration-150" href="/downloads">
            Reports
          </Link>
          <Link className="text-slate-300 hover:text-white transition-colors duration-150" href="/#resources">
            Resources
          </Link>
        </nav>

        {/* Action Items - Grouped at Far Right */}
        <div className="flex items-center space-x-4 shrink-0">
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

          {/* Mobile Menu Button */}
          <button
            type="button"
            className="md:hidden p-2 text-slate-300 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Quick Search Dropdown */}
      {searchOpen && (
        <div className="fixed top-20 inset-x-0 z-50 flex justify-center px-4 bg-[#050c18]/95 py-4 backdrop-blur-md border-b border-slate-800">
          <form onSubmit={handleSearchSubmit} className="w-full max-w-lg relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search route (e.g., DEL-BOM, BLR-DEL) or intelligence index…"
              className="w-full bg-[#081528] border border-cyan-500/40 rounded-full px-5 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00c2ff] shadow-lg"
              autoFocus
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#0284c7] hover:bg-[#0369a1] text-white px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors"
            >
              Search
            </button>
          </form>
        </div>
      )}

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#050c18] border-b border-slate-800 px-4 pt-2 pb-6 space-y-3">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm text-slate-300 hover:text-white border-b border-slate-800/60"
          >
            Home
          </Link>
          <Link
            href="/about"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm text-[#00c2ff] font-semibold border-b border-slate-800/60"
          >
            About
          </Link>
          <Link
            href="/#features"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm text-slate-300 hover:text-white border-b border-slate-800/60"
          >
            Features
          </Link>
          <Link
            href="/methodology"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm text-slate-300 hover:text-white border-b border-slate-800/60"
          >
            Data &amp; Methodology
          </Link>
          <Link
            href="/overview"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm text-slate-300 hover:text-white border-b border-slate-800/60"
          >
            Dashboard
          </Link>
          <Link
            href="/downloads"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm text-slate-300 hover:text-white border-b border-slate-800/60"
          >
            Reports
          </Link>
          <Link
            href="/#resources"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm text-slate-300 hover:text-white"
          >
            Resources
          </Link>
        </div>
      )}
    </header>
  );
}
