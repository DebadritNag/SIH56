'use client';

import React, { useEffect, useState } from 'react';
import { ShieldAlert, RotateCw, Home, Terminal, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Log exception to institutional logging provider
    console.error('AirPulse App Error Boundary Caught:', error);
  }, [error]);

  const requestId = error.digest || 'ERR-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  const timestamp = new Date().toISOString();

  const handleCopy = () => {
    navigator.clipboard.writeText(`Request ID: ${requestId}\nTimestamp: ${timestamp}\nError: ${error.message}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-lg bg-white border border-[#E4E7EC] rounded-xl p-8 shadow-sm space-y-5">
        <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-600">
          <ShieldAlert className="w-6 h-6" />
        </div>

        <div className="space-y-1.5">
          <span className="text-[11px] font-bold font-mono tracking-widest text-rose-700 uppercase">
            APPLICATION RUNTIME FAULT
          </span>
          <h1 className="text-xl font-bold text-[#101828]">Something went wrong</h1>
          <p className="text-xs text-[#475467] leading-relaxed">
            AirPulse could not complete this request. The analytical service may be momentarily degraded or the requested data structure failed client validation.
          </p>
        </div>

        {/* Audit Metadata Strip */}
        <div className="p-3 bg-slate-50 border border-[#E4E7EC] rounded-lg text-left text-[11px] font-mono text-[#667085] space-y-1.5">
          <div className="flex items-center justify-between">
            <span>Request ID:</span>
            <div className="flex items-center gap-1.5 font-bold text-[#101828]">
              <span>{requestId}</span>
              <button onClick={handleCopy} className="p-1 hover:text-blue-600 transition-colors" title="Copy Error Dossier">
                {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
          <div className="flex justify-between">
            <span>Timestamp:</span>
            <span>{timestamp}</span>
          </div>
          <div className="flex justify-between">
            <span>Environment:</span>
            <span>Production / Audit Mode</span>
          </div>
        </div>

        {/* Development Expandable Details (Safe in dev, suppressed in prod) */}
        {process.env.NODE_ENV !== 'production' && (
          <div className="text-left">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              <span>{showDetails ? 'Hide technical stack trace' : 'Show technical stack trace'}</span>
            </button>

            {showDetails && (
              <pre className="mt-2 p-3 bg-slate-950 text-slate-100 rounded text-[10px] font-mono overflow-x-auto whitespace-pre-wrap leading-tight max-h-48 border border-slate-800">
                {error.stack || error.message}
              </pre>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition-colors shadow-2xs flex items-center justify-center gap-1.5"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Retry Operation</span>
          </button>
          <Link
            href="/overview"
            className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-slate-50 text-[#344054] border border-[#D0D5DD] rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
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
    </div>
  );
}
