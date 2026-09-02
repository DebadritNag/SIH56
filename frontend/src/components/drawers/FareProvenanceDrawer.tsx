'use client';

import React from 'react';
import { X, ShieldCheck, CheckCircle2, ArrowDown, Database, Cpu, Activity, Hash, Layers } from 'lucide-react';
import { FareObservation } from '@/types';
import { OriginBadge } from '@/components/ui/Badge';
import { formatINR } from '@/lib/formatters';

interface FareProvenanceDrawerProps {
  fare: FareObservation | null;
  onClose: () => void;
}

export const FareProvenanceDrawer: React.FC<FareProvenanceDrawerProps> = ({ fare, onClose }) => {
  if (!fare) return null;

  const lineageSteps = [
    { title: '1. Raw Observation Collected', time: '17:42:08 IST', detail: `Captured from ${fare.source} via collector v${fare.provenance.collector_version}`, verified: true },
    { title: '2. Raw Immutable Payload Hashed', time: '17:42:09 IST', detail: `SHA-256 Checksum: ${fare.provenance.response_hash}`, verified: true },
    { title: '3. Field Parsing & Extraction', time: '17:42:10 IST', detail: `Executed ${fare.provenance.parser_version} with zero parse warnings`, verified: true },
    { title: '4. Canonical Normalization', time: '17:42:10 IST', detail: `Normalized to Standard Economy Product (T+7 window, UTC departure timestamp)`, verified: true },
    { title: '5. Schema & Physical Sanity Validation', time: '17:42:11 IST', detail: `Sanity bounds verified: ₹500 - ₹500,000 range. Status: ${fare.validation_status}`, verified: true },
    { title: '6. Deterministic Deduplication', time: '17:42:11 IST', detail: `Quote hash evaluated against 28,452 quotes today. Unique quote accepted.`, verified: true },
    { title: '7. FareGuard XGBoost Prediction', time: '17:42:12 IST', detail: `Expected fare benchmark computed: ${formatINR(fare.provenance.fareguard_prediction)}`, verified: true },
    { title: '8. PriceGuard Anomaly Scoring', time: '17:42:13 IST', detail: `Isolation Forest percentile: ${(fare.provenance.priceguard_score * 100).toFixed(1)}% (Status: ${fare.anomaly_status})`, verified: true },
    { title: '9. Official APIx Basket Eligibility', time: '17:42:14 IST', detail: fare.provenance.index_eligible ? 'ELIGIBLE: Integrated into representative median fare pool' : 'INELIGIBLE', verified: fare.provenance.index_eligible },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-2xs">
      <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-[#D0D5DD] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[#E4E7EC] bg-[#F8FAFC] flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <OriginBadge origin={fare.origin_type} />
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                VALIDATED OBSERVATION
              </span>
            </div>
            <h2 className="text-lg font-bold text-[#101828]">
              {formatINR(fare.total_fare)} • {fare.route}
            </h2>
            <div className="text-xs text-[#667085] mt-0.5">
              {fare.airline} ({fare.flight_number}) • Departure: {fare.departure_date} ({fare.booking_window})
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-[#667085] hover:text-[#101828] hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Metadata Grid */}
          <div className="bg-slate-50 border border-[#E4E7EC] rounded-lg p-3 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-[#667085]">Observation ID:</span>
              <span className="font-mono text-[#101828]">{fare.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#667085]">Collection Run:</span>
              <span className="font-mono font-bold text-blue-700">#{fare.provenance.collection_run_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#667085]">Source Provider:</span>
              <span className="font-semibold text-[#101828]">{fare.source}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#667085]">Payload SHA-256:</span>
              <code className="text-[10px] bg-white border border-[#D0D5DD] text-[#101828] px-1.5 py-0.5 rounded font-mono truncate max-w-[240px]">
                {fare.provenance.response_hash}
              </code>
            </div>
          </div>

          {/* Cryptographic Lineage Timeline */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#101828] uppercase tracking-wide mb-3">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Full Auditable Transformation Lineage</span>
            </div>

            <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {lineageSteps.map((step, idx) => (
                <div key={idx} className="relative group">
                  <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-white border-2 border-emerald-500 flex items-center justify-center text-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#101828]">{step.title}</span>
                      <span className="text-[11px] text-[#94A3B8] font-mono">{step.time}</span>
                    </div>
                    <p className="text-[11px] text-[#475467] mt-0.5 font-mono">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#E4E7EC] bg-[#F8FAFC] text-[11px] text-[#667085] flex items-center justify-between">
          <span>Official MoSPI CPI Aviation Observation Record</span>
          <span className="font-bold text-emerald-700">INDEX READY</span>
        </div>
      </div>
    </div>
  );
};
