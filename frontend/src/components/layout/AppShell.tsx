'use client';

import React, { useState } from 'react';
import { Radio } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { TopCommandBar } from './TopCommandBar';
import { CommandPalette } from './CommandPalette';
import { PresentationModeBar } from './PresentationModeBar';
import { ServiceBannerManager } from '../system/ServiceBannerManager';
import { useRealtimeSubscription } from '@/lib/hooks/useRealtimeSubscription';

interface AppShellProps {
  children: React.ReactNode;
}

const REALTIME_LABEL: Record<string, { text: string; className: string; pulse: boolean }> = {
  connected: { text: 'Live', className: 'text-emerald-700 bg-emerald-50 border-emerald-200', pulse: true },
  connecting: { text: 'Connecting…', className: 'text-amber-700 bg-amber-50 border-amber-200', pulse: false },
  error: { text: 'Offline', className: 'text-rose-700 bg-rose-50 border-rose-200', pulse: false },
  disabled: { text: 'Polling', className: 'text-slate-600 bg-slate-50 border-slate-200', pulse: false },
};

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);

  // Subscribe to Supabase Realtime; updates invalidate matching TanStack Query caches
  // so the UI refreshes live without a page reload (FastAPI stays source of truth).
  const { status: realtimeStatus } = useRealtimeSubscription();
  const rt = REALTIME_LABEL[realtimeStatus] ?? REALTIME_LABEL.disabled;

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex text-[#101828]">
      {/* Sidebar Navigation */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Top Command Bar */}
        <TopCommandBar
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          isPresentationMode={presentationMode}
          onTogglePresentationMode={() => setPresentationMode(!presentationMode)}
        />

        {/* Global Prioritized System Banner Manager */}
        <ServiceBannerManager />

        {/* SIH Demo Presentation Mode bar when enabled */}
        {presentationMode && (
          <PresentationModeBar onClose={() => setPresentationMode(false)} />
        )}

        {/* Realtime connection indicator */}
        <div className="px-6 pt-3 max-w-[1600px] w-full mx-auto flex justify-end">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-semibold ${rt.className}`}
            title={`Supabase Realtime: ${realtimeStatus}`}
          >
            <Radio className={`w-3 h-3 ${rt.pulse ? 'animate-pulse' : ''}`} />
            {rt.text}
          </span>
        </div>

        {/* Main Content Viewport */}
        <main className="flex-1 px-6 pb-6 pt-2 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Command Palette Modal */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </div>
  );
};
