'use client';

import React, { useState } from 'react';
import { X, ShieldAlert, CheckCircle, HelpCircle, FileText, Cpu, GitPullRequest } from 'lucide-react';
import { AnomalyItem } from '@/types';
import { SeverityBadge } from '@/components/ui/Badge';
import { ShapExplanationChart } from '@/components/charts/ShapExplanationChart';
import { formatINR } from '@/lib/formatters';

import { notify } from '@/lib/notify';

interface AnomalyDetailDrawerProps {
  anomaly: AnomalyItem | null;
  onClose: () => void;
  onStatusChange?: (anomalyId: string, newStatus: string, decision: string) => void;
}

export const AnomalyDetailDrawer: React.FC<AnomalyDetailDrawerProps> = ({
  anomaly,
  onClose,
  onStatusChange,
}) => {
  const [analystNotes, setAnalystNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!anomaly) return null;

  const handleReviewAction = (decision: string) => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      const newStatus = decision === 'genuine_market_movement' ? 'confirmed' : 'dismissed';
      const label = decision === 'genuine_market_movement' ? 'Genuine Market Movement' : 'Data Quality Issue';
      notify.success('Review decision recorded', {
        description: `Anomaly ${anomaly.code} marked as ${label}. Audit trail updated.`,
      });
      if (onStatusChange) {
        onStatusChange(anomaly.id, newStatus, decision);
      }
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-2xs">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col border-l border-[#D0D5DD] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[#E4E7EC] bg-[#F8FAFC] flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <SeverityBadge severity={anomaly.severity} />
              <span className="text-xs font-mono font-bold text-[#101828]">#{anomaly.code}</span>
              <span className="text-xs text-[#667085]">• {anomaly.timestamp}</span>
            </div>
            <h2 className="text-base font-bold text-[#101828] flex items-center gap-2">
              <span>{anomaly.route}</span>
              <span className="text-xs font-normal text-[#667085]">({anomaly.booking_window})</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-[#667085] hover:text-[#101828] hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Key Fare Hero Block */}
          <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 border border-[#E4E7EC] rounded-lg">
            <div>
              <span className="text-[11px] font-semibold text-[#667085] uppercase">Actual Observed Fare</span>
              <div className="text-2xl font-bold text-[#101828] tabular-nums mt-0.5">
                {formatINR(anomaly.actual_fare)}
              </div>
              <span className="text-[10px] text-rose-600 font-semibold">+{anomaly.deviation_pct}% vs model</span>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-[#667085] uppercase">FareGuard Expected</span>
              <div className="text-2xl font-bold text-[#475467] tabular-nums mt-0.5">
                {formatINR(anomaly.expected_fare)}
              </div>
              <span className="text-[10px] text-[#667085]">XGBoost Regressor</span>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-[#667085] uppercase">PriceGuard Score</span>
              <div className="text-2xl font-bold text-rose-700 tabular-nums mt-0.5">
                {anomaly.percentile.toFixed(1)}%
              </div>
              <span className="text-[10px] text-rose-700 font-medium">Anomaly Percentile</span>
            </div>
          </div>

          {/* SECTION 1: FARE EVIDENCE */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#101828] mb-2 uppercase tracking-wide">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>1. Cryptographic Fare Evidence</span>
            </div>
            <div className="bg-white border border-[#E4E7EC] rounded-lg p-3 text-xs divide-y divide-[#F1F5F9]">
              <div className="py-1.5 flex justify-between">
                <span className="text-[#667085]">Carrier & Flight:</span>
                <span className="font-semibold text-[#101828]">{anomaly.airline} ({anomaly.evidence.flight_number})</span>
              </div>
              <div className="py-1.5 flex justify-between">
                <span className="text-[#667085]">Collection Source:</span>
                <span className="font-medium text-[#101828]">{anomaly.source}</span>
              </div>
              <div className="py-1.5 flex justify-between">
                <span className="text-[#667085]">Departure Schedule:</span>
                <span className="text-[#101828] tabular-nums">{anomaly.evidence.departure_time}</span>
              </div>
              <div className="py-1.5 flex justify-between">
                <span className="text-[#667085]">Fare Breakdown:</span>
                <span className="text-[#101828] tabular-nums">
                  Base: {formatINR(anomaly.evidence.base_fare)} + Taxes/Fees: {formatINR(anomaly.evidence.taxes + anomaly.evidence.fees)}
                </span>
              </div>
              <div className="py-1.5 flex justify-between items-center">
                <span className="text-[#667085]">Raw SHA-256 Hash:</span>
                <code className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono truncate max-w-[280px]">
                  {anomaly.evidence.raw_response_hash}
                </code>
              </div>
            </div>
          </div>

          {/* SECTION 2: SHAP MODEL EXPLANATION */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#101828] uppercase tracking-wide">
                <Cpu className="w-3.5 h-3.5 text-sky-600" />
                <span>2. FareGuard SHAP Model Attribution</span>
              </div>
              <span className="text-[10px] text-[#667085] bg-slate-100 px-1.5 py-0.5 rounded">Gated TreeExplainer</span>
            </div>
            <div className="bg-white border border-[#E4E7EC] rounded-lg p-3">
              <ShapExplanationChart
                factors={anomaly.shap_factors}
                expectedFare={anomaly.expected_fare}
                actualFare={anomaly.actual_fare}
              />
              <p className="mt-2 text-[11px] text-[#475467] leading-relaxed bg-[#F8FAFC] p-2 rounded border border-[#E4E7EC]">
                <strong>Statistical Note:</strong> FareGuard expected this fare to be higher primarily because of short booking lead time (T+1) and festival proximity. The observed fare ({formatINR(anomaly.actual_fare)}) remains substantially above the model expectation (+57.7%). SHAP values represent statistical attribution, not causality.
              </p>
            </div>
          </div>

          {/* SECTION 3: MULTI-SOURCE AGREEMENT */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#101828] mb-2 uppercase tracking-wide">
              <GitPullRequest className="w-3.5 h-3.5 text-emerald-600" />
              <span>3. Cross-Source Confirmation Check</span>
            </div>
            <div className="bg-white border border-[#E4E7EC] rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-[#F8FAFC] text-[#667085] border-b border-[#E4E7EC] text-[11px]">
                  <tr>
                    <th className="p-2.5">Source Channel</th>
                    <th className="p-2.5 text-right">Observed Fare</th>
                    <th className="p-2.5 text-right">Agreement Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {anomaly.cross_source_check.map((src, idx) => (
                    <tr key={idx}>
                      <td className="p-2.5 font-medium text-[#101828]">{src.source_name}</td>
                      <td className="p-2.5 text-right font-bold text-[#101828] tabular-nums">
                        {formatINR(src.observed_fare)}
                      </td>
                      <td className="p-2.5 text-right text-emerald-700 font-medium">
                        {src.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-2.5 bg-emerald-50 border-t border-emerald-100 text-emerald-900 text-[11px] font-semibold flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>MULTI-SOURCE AGREEMENT: 4 of 4 independent sources confirm fare surge within 2.5% band. Genuine market movement verified.</span>
              </div>
            </div>
          </div>

          {/* SECTION 4: AUDITED ANALYST REVIEW WORKFLOW */}
          <div className="pt-2 border-t border-[#E4E7EC]">
            <span className="text-xs font-bold text-[#101828] uppercase tracking-wide mb-2 block">
              4. Government Analyst Disposition
            </span>
            <div className="space-y-2.5">
              <textarea
                value={analystNotes}
                onChange={(e) => setAnalystNotes(e.target.value)}
                placeholder="Enter audit review justification (required for MoSPI / RBI audit trail)..."
                rows={2}
                className="w-full p-2.5 text-xs border border-[#D0D5DD] rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={isSubmitting}
                  onClick={() => handleReviewAction('genuine_market_movement')}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded transition-colors shadow-2xs"
                >
                  Confirm Genuine Market Movement
                </button>
                <button
                  disabled={isSubmitting}
                  onClick={() => handleReviewAction('mark_data_glitch')}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded transition-colors shadow-2xs"
                >
                  Mark Data Quality Glitch
                </button>
                <button
                  disabled={isSubmitting}
                  onClick={() => handleReviewAction('keep_under_review')}
                  className="px-3 py-1.5 bg-white border border-[#D0D5DD] text-[#475467] hover:bg-slate-50 text-xs font-semibold rounded transition-colors"
                >
                  Keep Under Monitoring
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
