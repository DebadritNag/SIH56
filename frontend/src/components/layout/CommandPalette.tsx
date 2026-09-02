'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, MapPin, AlertTriangle, Terminal, Activity, ArrowRight, X } from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CommandItem {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const COMMAND_ITEMS: CommandItem[] = [
  { id: '1', category: 'Routes', title: 'DEL → BOM (Delhi - Mumbai)', subtitle: 'Heavy corridor • Traffic Weight 14.2%', href: '/routes/del-bom', icon: MapPin },
  { id: '2', category: 'Routes', title: 'DEL → BLR (Delhi - Bengaluru)', subtitle: 'Business route • Traffic Weight 11.5%', href: '/routes/del-blr', icon: MapPin },
  { id: '3', category: 'Anomalies', title: 'Open Anomaly #ANM-1842', subtitle: 'DEL-BOM +57.7% deviation • Gated SHAP ready', href: '/anomalies/anm-1842', icon: AlertTriangle },
  { id: '4', category: 'Testing', title: 'Run Live Web Scraping Verification', subtitle: 'Controlled single-request extraction probe', href: '/scraping-test', icon: Terminal },
  { id: '5', category: 'Operations', title: 'Data Ingestion Control Room', subtitle: 'View Batch Collection Run #1842', href: '/ingestion', icon: Activity },
  { id: '6', category: 'Index', title: 'Airfare Price Index (APIx) Breakdown', subtitle: 'Laspeyres basket decomposition & relatives', href: '/apix', icon: Activity },
  { id: '7', category: 'System', title: 'System Diagnostics & 12-Point Self-Test', subtitle: 'Verify Database, ML models, & Redis worker', href: '/system', icon: Terminal },
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(); // parent can toggle
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filtered = COMMAND_ITEMS.filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.subtitle.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (href: string) => {
    router.push(href);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-xl bg-white rounded-lg shadow-2xl border border-[#D0D5DD] overflow-hidden">
        {/* Search input */}
        <div className="flex items-center px-4 border-b border-[#E4E7EC]">
          <Search className="w-4 h-4 text-[#667085] mr-2.5" />
          <input
            type="text"
            placeholder="Type a route, airport code, or operational action..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full py-3.5 text-xs text-[#101828] focus:outline-none placeholder-[#94A3B8]"
          />
          <button onClick={onClose} className="p-1 text-[#667085] hover:text-[#101828]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-[#F8FAFC]">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#667085]">
              No matching routes, anomalies, or system actions found.
            </div>
          ) : (
            filtered.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.href)}
                  className="w-full flex items-center justify-between p-2.5 rounded hover:bg-[#F8FAFC] text-left transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded bg-slate-100 text-[#475467] group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[#101828]">{item.title}</div>
                      <div className="text-[11px] text-[#667085]">{item.subtitle}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-[#94A3B8] px-2 py-0.5 rounded bg-slate-50 uppercase">
                    {item.category}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#F8FAFC] px-4 py-2 border-t border-[#E4E7EC] flex items-center justify-between text-[11px] text-[#667085]">
          <span>Navigation Quick Actions</span>
          <span>Press <kbd className="px-1 py-0.5 bg-white border border-[#D0D5DD] rounded text-[10px]">ESC</kbd> to close</span>
        </div>
      </div>
    </div>
  );
};
