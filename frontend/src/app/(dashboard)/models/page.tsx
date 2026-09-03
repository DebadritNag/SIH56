'use client';

import React from 'react';
import { Cpu, ShieldCheck, CheckCircle2, Code, Layers } from 'lucide-react';
import { GenerateReportButton } from '@/components/data/GenerateReportButton';

export default function ModelsPage() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl md:text-2xl font-bold text-[#101828] tracking-tight">
              Model Governance &amp; Machine Learning Architecture
            </h1>
          </div>
          <p className="text-xs text-[#475467] mt-0.5">
            Model cards, training hyperparameters, evaluation metrics, and SHAP explainability specifications for FareGuard and PriceGuard.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GenerateReportButton
            exportType="MODEL_REPORT"
            format="PDF"
            title="AirPulse — FareGuard & PriceGuard Model Registry"
          />
        </div>
      </div>

      {/* Two Model Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* FareGuard Card */}
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-mono font-bold text-xs rounded border border-blue-200">
                FAREGUARD-V2.4
              </span>
              <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Production Active
              </span>
            </div>
            <h3 className="text-base font-bold text-[#101828]">FareGuard (Expected Fare Regressor)</h3>
            <p className="text-xs text-[#475467] mt-1">
              Supervised gradient-boosted decision trees (XGBoost Regressor) trained on historical median fares, advance purchase days, seasonal holidays, route distance, and fuel lag indices.
            </p>

            <div className="mt-4 space-y-2 border-t border-[#F1F5F9] pt-3 text-xs">
              <div className="flex justify-between">
                <span className="text-[#667085]">Algorithm:</span>
                <span className="font-mono text-[#101828]">XGBoost 2.0.3 (HistGradient)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#667085]">Evaluation RMSE:</span>
                <span className="font-mono font-bold text-emerald-700">₹342.10 (4.2% MAPE)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#667085]">Training Sample:</span>
                <span className="font-mono text-[#101828]">1,840,000 Verified Quotes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#667085]">SHAP Attribution:</span>
                <span className="font-mono text-blue-700">TreeSHAP Enabled (Gated)</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#F1F5F9] text-[11px] text-[#667085]">
            Last Retrained: 01 Sep 2026 • Automated Weekly Retrain Pipeline
          </div>
        </div>

        {/* PriceGuard Card */}
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="px-2 py-0.5 bg-rose-50 text-rose-700 font-mono font-bold text-xs rounded border border-rose-200">
                PRICEGUARD-V1.8
              </span>
              <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Production Active
              </span>
            </div>
            <h3 className="text-base font-bold text-[#101828]">PriceGuard (Multivariate Anomaly Detector)</h3>
            <p className="text-xs text-[#475467] mt-1">
              Unsupervised multi-dimensional isolation forest that scores anomalies based on route-window historical distributions, cross-carrier standard deviations, and sudden spike velocity.
            </p>

            <div className="mt-4 space-y-2 border-t border-[#F1F5F9] pt-3 text-xs">
              <div className="flex justify-between">
                <span className="text-[#667085]">Algorithm:</span>
                <span className="font-mono text-[#101828]">Isolation Forest (n_estimators=200)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#667085]">Contamination Threshold:</span>
                <span className="font-mono font-bold text-rose-700">0.04 (Strict 4% upper tail)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#667085]">False Positive Suppression:</span>
                <span className="font-mono text-[#101828]">4-Way Cross-Source Concurrence</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#667085]">Audited Decision Loop:</span>
                <span className="font-mono text-emerald-700">Human-In-The-Loop Active</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#F1F5F9] text-[11px] text-[#667085]">
            Last Retrained: 01 Sep 2026 • Automated Weekly Retrain Pipeline
          </div>
        </div>
      </div>
    </div>
  );
}
