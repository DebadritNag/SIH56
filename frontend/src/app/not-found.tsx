import React from 'react';
import Link from 'next/link';
import { SearchX, ArrowLeft, Home, Terminal } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md bg-white border border-[#E4E7EC] rounded-xl p-8 shadow-sm space-y-5">
        <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-600">
          <SearchX className="w-6 h-6" />
        </div>

        <div className="space-y-1.5">
          <span className="text-[11px] font-bold font-mono tracking-widest text-slate-500 uppercase">
            STATUS 404 • ROUTE UNRESOLVED
          </span>
          <h1 className="text-xl font-bold text-[#101828]">Page not found</h1>
          <p className="text-xs text-[#475467] leading-relaxed">
            The requested AirPulse workspace could not be located. The page may have moved, the route parameter may be invalid, or you may not have access to this resource.
          </p>
        </div>

        <div className="p-3 bg-slate-50 border border-[#E4E7EC] rounded-lg text-left text-[11px] font-mono text-[#667085] space-y-1">
          <div className="flex justify-between">
            <span>System:</span>
            <span className="text-[#101828] font-bold">AirPulse / MoSPI</span>
          </div>
          <div className="flex justify-between">
            <span>Basket Version:</span>
            <span>2026-Q3</span>
          </div>
          <div className="flex justify-between">
            <span>Action:</span>
            <span>Verify URL or return to dashboard</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
          <Link
            href="/overview"
            className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition-colors shadow-2xs flex items-center justify-center gap-1.5"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Return to Overview</span>
          </Link>
          <Link
            href="/system"
            className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-slate-50 text-[#344054] border border-[#D0D5DD] rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Diagnostics</span>
          </Link>
        </div>
      </div>

      <div className="mt-6 text-[11px] text-[#94A3B8]">
        AirPulse National Airfare Price Intelligence Platform • Ministry of Statistics and Programme Implementation
      </div>
    </div>
  );
}
