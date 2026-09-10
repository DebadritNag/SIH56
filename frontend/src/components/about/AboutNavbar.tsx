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
    <header className="sticky top-0 z-50 bg-[#050c18]/95 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center group shrink-0" title="VAYANTARA Home">
          <div className="relative flex items-center justify-center py-1">
            <Image
              src="/top left.png"
              alt="VAYANTARA"
              width={180}
              height={60}
              priority
              unoptimized
              className="w-[150px] sm:w-[175px] h-auto object-contain filter brightness-[1.22] contrast-[1.15] saturate-[1.15] drop-shadow-[0_0_1px_rgba(255,255,255,0.35)] transition-transform duration-200 group-hover:scale-[1.02]"
            />
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center space-x-7 text-xs tracking-wider uppercase font-medium text-slate-300">
          <Link className="hover:text-white transition-colors" href="/">
            Home
          </Link>
          <Link className="text-[#00c2ff] font-semibold border-b-2 border-[#00c2ff] pb-1" href="/about">
            About
          </Link>
          <Link className="hover:text-white transition-colors" href="/#features">
            Features
          </Link>
          <Link className="hover:text-white transition-colors" href="/methodology">
            Data &amp; Methodology
          </Link>
          <Link className="hover:text-white transition-colors" href="/overview">
            Dashboard
          </Link>
          <Link className="hover:text-white transition-colors" href="/downloads">
            Reports
          </Link>
          <Link className="hover:text-white transition-colors" href="/#resources">
            Resources
          </Link>
        </nav>

        {/* Right Action */}
        <div className="flex items-center gap-4">
          <button
            aria-label="Search routes and intelligence"
            className="p-2 text-slate-300 hover:text-white transition-colors cursor-pointer"
            type="button"
            onClick={() => setSearchOpen(!searchOpen)}
          >
            <Search className="w-5 h-5" />
          </button>
          <Link
            className="inline-flex items-center gap-2 bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-semibold px-4 py-2.5 rounded shadow transition-all duration-150 active:scale-95 cursor-pointer"
            href="/signup"
          >
            <span>Get Access</span>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
            </svg>
          </Link>

          {/* Mobile Menu Button */}
          <button
            type="button"
            className="md:hidden p-2 text-slate-300 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Quick Search Dropdown */}
      {searchOpen && (
        <div className="fixed top-20 inset-x-0 z-50 flex justify-center px-4 bg-[#050c18]/90 py-4 backdrop-blur-md border-b border-slate-800">
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
