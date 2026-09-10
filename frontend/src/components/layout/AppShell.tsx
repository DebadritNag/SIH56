'use client';

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopCommandBar } from './TopCommandBar';
import { CommandPalette } from './CommandPalette';
import { PresentationModeBar } from './PresentationModeBar';
import { ServiceBannerManager } from '../system/ServiceBannerManager';
import { useRealtimeSubscription } from '@/lib/hooks/useRealtimeSubscription';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);

  // Subscribe to Supabase Realtime; updates invalidate matching TanStack Query caches
  // so the UI refreshes live without a page reload (FastAPI stays source of truth).
  useRealtimeSubscription();

  return (
    <div className="min-h-screen bg-white flex text-[#101828]">
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
