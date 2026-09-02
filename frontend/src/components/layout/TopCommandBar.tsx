'use client';

import React, { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Bell, BookOpen, ShieldCheck, Presentation, Download, LogOut, UserCircle2 } from 'lucide-react';
import Link from 'next/link';
import { DownloadCenterModal } from '../notifications/DownloadCenterModal';
import { useAuth } from '@/lib/providers/AuthProvider';

interface TopCommandBarProps {
  onOpenCommandPalette?: () => void;
  isPresentationMode?: boolean;
  onTogglePresentationMode?: () => void;
}

export const TopCommandBar: React.FC<TopCommandBarProps> = ({
  onOpenCommandPalette,
  isPresentationMode = false,
  onTogglePresentationMode,
}) => {
  const [showDownloadCenter, setShowDownloadCenter] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  const userEmail = user?.email ?? 'analyst@airpulse.local';
  const userInitial = userEmail.charAt(0).toUpperCase();

  // Generate breadcrumbs from route
  const pathSegments = pathname.split('/').filter(Boolean);
  const breadcrumb = pathSegments.length > 0
    ? pathSegments.map((s) => s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ')).join(' / ')
    : 'Executive Intelligence';

  return (
    <header className="h-[60px] bg-white border-b border-[#E4E7EC] px-6 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
      {/* Left Breadcrumb */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-[#667085] font-medium">National Aviation Intelligence</span>
        <span className="text-[#D0D5DD]">/</span>
        <span className="text-[#101828] font-semibold">{breadcrumb}</span>
      </div>

      {/* Center Search / Command Palette trigger */}
      <div className="flex-1 max-w-md mx-6 hidden md:block">
        <button
          onClick={onOpenCommandPalette}
          className="w-full flex items-center justify-between px-3 py-1.5 bg-[#F8FAFC] border border-[#D0D5DD] rounded-md text-xs text-[#667085] hover:border-slate-400 transition-colors shadow-2xs"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-[#667085]" />
            <span>Search route, airport, collector, or anomaly (e.g. DEL-BOM, ANM-1842)...</span>
          </div>
          <kbd className="px-1.5 py-0.5 bg-white border border-[#D0D5DD] rounded text-[10px] text-[#475467] font-mono">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right Telemetry & Status */}
      <div className="flex items-center gap-3.5">
        {/* Presentation Mode Toggle for SIH Judges */}
        {onTogglePresentationMode && (
          <button
            onClick={onTogglePresentationMode}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border transition-all ${
              isPresentationMode
                ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-xs'
                : 'bg-white text-[#475467] border-[#D0D5DD] hover:bg-slate-50'
            }`}
            title="Enable SIH Demo Presentation Mode for guided demonstration"
          >
            <Presentation className="w-3.5 h-3.5 text-amber-700" />
            <span>SIH Demo Mode</span>
          </button>
        )}

        {/* Live Freshness Indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded text-xs font-semibold text-emerald-800">
          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
          <span>● LIVE DATA</span>
          <span className="text-[11px] font-normal text-emerald-700 ml-1">Updated 2m ago</span>
        </div>

        {/* Audit Status */}
        <div className="hidden lg:flex items-center gap-1 text-xs text-[#475467] border-l border-[#E4E7EC] pl-3">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          <span>SHA-256 Verified</span>
        </div>

        {/* Download Center Trigger */}
        <button
          onClick={() => setShowDownloadCenter(true)}
          className="p-1.5 text-[#475467] hover:text-[#101828] hover:bg-slate-100 rounded transition-colors relative"
          title="Export & Download Center"
        >
          <Download className="w-4 h-4 text-blue-600" />
        </button>

        {/* Methodology link */}
        <Link
          href="/methodology"
          className="p-1.5 text-[#475467] hover:text-[#101828] hover:bg-slate-100 rounded transition-colors"
          title="Statistical Methodology Documentation"
        >
          <BookOpen className="w-4 h-4" />
        </Link>

        {/* Notifications */}
        <Link
          href="/alerts"
          className="p-1.5 text-[#475467] hover:text-[#101828] hover:bg-slate-100 rounded transition-colors relative"
          title="System Alerts"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500" />
        </Link>

        {/* User menu */}
        <div className="relative border-l border-[#E4E7EC] pl-3">
          <button
            onClick={() => setShowUserMenu((v) => !v)}
            className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Account"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[#081426] text-xs font-bold text-white">
              {userInitial}
            </span>
          </button>
          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-11 z-40 w-60 rounded-lg border border-[#E4E7EC] bg-white p-1.5 shadow-lg">
                <div className="flex items-center gap-2 px-2.5 py-2">
                  <UserCircle2 className="h-8 w-8 text-slate-400" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[#101828]">{userEmail}</p>
                    <p className="text-[11px] text-[#667085]">Signed in</p>
                  </div>
                </div>
                <div className="my-1 border-t border-[#F1F5F9]" />
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <DownloadCenterModal
        open={showDownloadCenter}
        onClose={() => setShowDownloadCenter(false)}
      />
    </header>
  );
};
