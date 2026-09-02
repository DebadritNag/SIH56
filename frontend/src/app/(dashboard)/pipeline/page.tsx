'use client';

import React from 'react';
import { GitCommit, ArrowRight, CheckCircle2, RotateCw } from 'lucide-react';

const NODES = [
  { name: '1. Web Scraping & Ingestion', workers: '4 Celery Workers', qps: '18 req/s', status: 'ACTIVE', color: 'border-blue-400' },
  { name: '2. Raw Payload Envelope', workers: 'PostgreSQL JSONB', qps: 'SHA-256 Digest', status: 'ACTIVE', color: 'border-emerald-400' },
  { name: '3. Normalization & Sanity', workers: 'Pydantic v2 Validator', qps: '97.4% Pass Rate', status: 'ACTIVE', color: 'border-emerald-400' },
  { name: '4. FareGuard Expected Model', workers: 'XGBoost Inference', qps: '4.2ms / quote', status: 'ACTIVE', color: 'border-blue-400' },
  { name: '5. PriceGuard Anomaly Scorer', workers: 'Isolation Forest', qps: '0.04 Contam', status: 'ACTIVE', color: 'border-rose-400' },
  { name: '6. APIx Aggregation Engine', workers: 'Laspeyres Math Core', qps: 'Daily 00:00 IST', status: 'STANDBY', color: 'border-slate-300' },
];

export default function PipelineMonitorPage() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <GitCommit className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl md:text-2xl font-bold text-[#101828] tracking-tight">
              Pipeline Architecture &amp; Worker Mesh Monitor
            </h1>
          </div>
          <p className="text-xs text-[#475467] mt-0.5">
            End-to-end data pipeline topology showing queue depths, ingestion throughput, ML scoring latency, and persistence lag.
          </p>
        </div>
      </div>

      {/* Interactive Topology Mesh */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {NODES.map((node, idx) => (
          <div key={idx} className={`bg-white border-2 ${node.color} rounded-lg p-3.5 shadow-xs flex flex-col justify-between`}>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Stage 0{idx + 1}</span>
                <span className={`w-2 h-2 rounded-full ${node.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
              </div>
              <h3 className="text-xs font-bold text-[#101828]">{node.name}</h3>
            </div>

            <div className="mt-3 pt-2 border-t border-[#F1F5F9] text-[11px] font-mono text-[#667085]">
              <div>{node.workers}</div>
              <div className="text-[#101828] font-semibold mt-0.5">{node.qps}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
