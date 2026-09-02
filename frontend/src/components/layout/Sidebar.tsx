'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  BarChart3,
  TrendingUp,
  MapPin,
  Calendar,
  AlertTriangle,
  Zap,
  Bell,
  Database,
  Globe,
  DownloadCloud,
  CheckCircle2,
  GitCompare,
  Cpu,
  BookOpen,
  Server,
  Activity,
  ChevronLeft,
  ChevronRight,
  Shield,
  Terminal
} from 'lucide-react';

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface NavSection {
  title: string;
  items: {
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'EXECUTIVE INTELLIGENCE',
    items: [
      { label: 'Overview', href: '/overview', icon: BarChart3 },
    ],
  },
  {
    title: 'MARKET INTELLIGENCE',
    items: [
      { label: 'Market Monitor', href: '/market', icon: Activity },
      { label: 'APIx Index', href: '/apix', icon: TrendingUp },
      { label: 'Route Intelligence', href: '/routes', icon: MapPin },
      { label: 'Booking Windows', href: '/booking-windows', icon: Calendar },
    ],
  },
  {
    title: 'MONITORING & RISK',
    items: [
      { label: 'Anomaly Center', href: '/anomalies', icon: AlertTriangle, badge: '24' },
      { label: 'Price Shocks', href: '/shocks', icon: Zap, badge: '1' },
      { label: 'Alert Center', href: '/alerts', icon: Bell, badge: '5' },
    ],
  },
  {
    title: 'DATA OPERATIONS',
    items: [
      { label: 'Fare Explorer', href: '/fares', icon: Database },
      { label: 'Data Sources', href: '/sources', icon: Globe },
      { label: 'Data Ingestion', href: '/ingestion', icon: DownloadCloud },
      { label: 'Scraping Verification', href: '/scraping-test', icon: Terminal },
      { label: 'Data Quality Matrix', href: '/data-quality', icon: CheckCircle2 },
    ],
  },
  {
    title: 'ANALYTICS & MODELS',
    items: [
      { label: 'Index Backtesting', href: '/backtesting', icon: GitCompare },
      { label: 'ML Models (FareGuard)', href: '/models', icon: Cpu },
      { label: 'Official Methodology', href: '/methodology', icon: BookOpen },
    ],
  },
  {
    title: 'SYSTEM INFRASTRUCTURE',
    items: [
      { label: 'Pipeline Monitor', href: '/pipeline', icon: Server },
      { label: 'System Diagnostics', href: '/system', icon: Shield },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed = false,
  onToggleCollapse,
}) => {
  const pathname = usePathname();

  return (
    <aside
      className={clsx(
        'h-screen flex flex-col bg-[#081426] border-r border-[#132238] transition-all duration-200 select-none z-30 shrink-0 sticky top-0',
        collapsed ? 'w-[72px]' : 'w-[250px]'
      )}
    >
      {/* Brand Header */}
      <div className="h-[60px] flex items-center justify-between px-4 border-b border-[#132238]">
        <Link href="/overview" className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-black text-sm shrink-0 shadow-xs">
            AP
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white tracking-wide">AirPulse</span>
              <span className="text-[9px] text-[#94A3B8] uppercase tracking-wider font-medium">
                National Airfare Intel
              </span>
            </div>
          )}
        </Link>

        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            aria-label="Toggle Sidebar Navigation"
            className="p-1 rounded text-[#94A3B8] hover:text-white hover:bg-slate-800 transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-2.5 py-4 space-y-6">
        {NAV_SECTIONS.map((section, sIdx) => (
          <div key={sIdx} className="space-y-1">
            {!collapsed && (
              <div className="px-2 pb-1.5 text-[10px] font-bold text-[#64748B] tracking-wider uppercase">
                {section.title}
              </div>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/overview' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={clsx(
                    'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all group relative',
                    isActive
                      ? 'bg-[#132238] text-white'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#0D1E36]'
                  )}
                >
                  {/* Left Active Line Indicator */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-blue-500 rounded-r" />
                  )}
                  <Icon
                    className={clsx(
                      'w-4 h-4 shrink-0 transition-colors',
                      isActive ? 'text-blue-400' : 'text-[#64748B] group-hover:text-[#94A3B8]'
                    )}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {!collapsed && item.badge && (
                    <span
                      className={clsx(
                        'ml-auto text-[10px] font-bold px-1.5 py-0.2 rounded',
                        item.badge === '24' || item.badge === '1'
                          ? 'bg-rose-950/70 text-rose-300 border border-rose-800/60'
                          : 'bg-slate-800 text-slate-300'
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer Profile & State */}
      <div className="p-3 border-t border-[#132238] flex items-center justify-between text-xs bg-[#06101E]">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-white font-bold shrink-0">
            MS
          </div>
          {!collapsed && (
            <div className="flex flex-col truncate">
              <span className="text-white text-[11px] font-semibold truncate">MoSPI Analyst</span>
              <span className="text-[10px] text-emerald-400 font-medium">● Operational</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
