'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  MapPin,
  TrendingUp,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
  Layers,
  ChevronDown,
  Download,
} from 'lucide-react';
import { useRouteInsights } from '@/lib/hooks/useResources';
import { getMockRouteDetail } from '@/lib/mock-data/dashboard';
import { MarketPressureBadge } from '@/components/ui/Badge';
import { RouteAdvancePurchaseChart } from '@/components/charts/RouteAdvancePurchaseChart';
import { ExportDialog } from '@/components/dialogs/ExportDialog';
import { formatINR, formatPercent } from '@/lib/formatters';

const AVAILABLE_ROUTES = [
  { code: 'DEL-BOM', label: 'DEL → BOM (Delhi - Mumbai)' },
  { code: 'DEL-BLR', label: 'DEL → BLR (Delhi - Bengaluru)' },
  { code: 'BOM-BLR', label: 'BOM → BLR (Mumbai - Bengaluru)' },
  { code: 'DEL-CCU', label: 'DEL → CCU (Delhi - Kolkata)' },
  { code: 'HYD-DEL', label: 'HYD → DEL (Hyderabad - Delhi)' },
  { code: 'BOM-GOI', label: 'BOM → GOI (Mumbai - Goa)' },
  { code: 'BLR-PNQ', label: 'BLR → PNQ (Bengaluru - Pune)' },
  { code: 'CCU-GAU', label: 'CCU → GAU (Kolkata - Guwahati)' },
];

export default function RoutesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlRoute = searchParams.get('route');

  const [selectedRouteCode, setSelectedRouteCode] = useState(urlRoute || 'DEL-BOM');
  const [selectedWindows, setSelectedWindows] = useState<number[]>([1, 7, 15, 30, 45]);
  const [showExport, setShowExport] = useState(false);

  useEffect(() => {
    if (urlRoute && urlRoute !== selectedRouteCode) {
      setSelectedRouteCode(urlRoute);
    }
  }, [urlRoute]);

  const handleRouteChange = (newCode: string) => {
    setSelectedRouteCode(newCode);
    router.push(`/routes?route=${newCode}`, { scroll: false });
  };

  const { data: routeData, isFetching } = useRouteInsights(selectedRouteCode);
  const route = routeData || getMockRouteDetail(selectedRouteCode);

  return (
    <div className="space-y-5">
      {/* Route Header (Financial Security Detail Header) */}
      <div className="bg-white border border-[#E4E7EC] rounded-lg p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl font-black text-[#101828] tracking-tight">{route.route_code}</span>
            <span className="text-sm font-semibold text-[#475467]">• {route.origin} → {route.destination}</span>
            <MarketPressureBadge pressure={route.market_status} />
            {isFetching && (
              <span className="text-[10px] text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded font-mono animate-pulse">
                Updating...
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-[#667085]">
            <span>Flight Distance: <strong className="text-[#101828] font-mono">{route.distance_km} km</strong></span>
            <span>•</span>
            <span>DGCA Passenger Traffic Weight: <strong className="text-[#101828] font-mono">{route.traffic_weight_pct}%</strong></span>
            <span>•</span>
            <span className="flex items-center gap-1 text-emerald-700 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Statistical Confidence: {route.data_confidence_pct}%
            </span>
          </div>
        </div>

        {/* Route Selector & Export Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-[#667085] font-semibold">Select Route:</label>
          <select
            value={selectedRouteCode}
            onChange={(e) => handleRouteChange(e.target.value)}
            className="bg-[#F8FAFC] border border-[#D0D5DD] font-semibold text-xs text-[#101828] rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer min-w-[200px]"
          >
            {AVAILABLE_ROUTES.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </select>

          {/* T+ Booking Window Buttons */}
          <div className="flex items-center gap-1 bg-[#F1F5F9] p-0.5 rounded border border-[#E2E8F0]">
            {[1, 7, 15, 30, 45].map((w) => {
              const active = selectedWindows.includes(w);
              return (
                <button
                  key={w}
                  type="button"
                  onClick={() => {
                    if (active) {
                      if (selectedWindows.length === 1) return;
                      setSelectedWindows(selectedWindows.filter((x) => x !== w));
                    } else {
                      setSelectedWindows([...selectedWindows, w].sort((a, b) => a - b));
                    }
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                    active ? 'bg-white text-blue-700 shadow-2xs border border-blue-200' : 'text-[#94A3B8] hover:text-[#475467]'
                  }`}
                  title={`Toggle T+${w} window`}
                >
                  T+{w}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#D0D5DD] text-xs font-semibold text-[#101828] rounded shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Export Route Report</span>
          </button>
        </div>
      </div>

      <ExportDialog
        open={showExport}
        onClose={() => setShowExport(false)}
        exportType="ROUTE_INTELLIGENCE"
        defaultFormat="PDF"
        title={`Corridor Performance Report (${selectedRouteCode})`}
        filters={{ route: selectedRouteCode }}
        filterSummary={[
          { label: 'Corridor', value: selectedRouteCode },
          { label: 'DGCA Passenger Traffic Weight', value: `${route.traffic_weight_pct}%` },
          { label: 'Market Status', value: route.market_status },
        ]}
      />

      {/* Hero Section: Current Representative Fare & Advance Purchase Curve */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-w-0">
        {/* Current Representative Fare Card (approx 35% / 4 cols) */}
        <div className="lg:col-span-4 bg-white border border-[#E4E7EC] rounded-lg p-5 shadow-xs flex flex-col justify-between min-w-0">
          <div>
            <span className="text-xs font-semibold text-[#475467] uppercase tracking-wider block">
              Current Representative Fare (Median)
            </span>
            <div className="text-4xl font-bold text-[#101828] tabular-nums tracking-tight mt-2">
              {formatINR(route.current_median_fare)}
            </div>
            <span className="text-xs text-[#667085] mt-1 block">
              Calculated across 4 independent sources &amp; 906 validated quotes
            </span>

            <div className="mt-4 space-y-2 border-t border-[#F1F5F9] pt-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#667085]">7-Day Velocity:</span>
                <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 tabular-nums">
                  +{route.change_7d_pct}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#667085]">30-Day Velocity:</span>
                <span className="font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 tabular-nums">
                  +{route.change_30d_pct}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#667085]">Base Reference Fare (Aug 2026):</span>
                <span className="font-mono text-[#101828]">
                  {formatINR(Math.round(route.current_median_fare / (1 + route.change_30d_pct / 100)))}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#667085]">Current Route Relative:</span>
                <span className="font-mono font-bold text-blue-700">
                  {(100 + route.change_30d_pct).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#F1F5F9] text-[11px] text-[#667085] flex items-center justify-between">
            <span>
              APIx Contribution:{' '}
              <strong className={route.change_7d_pct >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                {route.change_7d_pct >= 0 ? '+' : ''}
                {((route.change_7d_pct * route.traffic_weight_pct) / 100).toFixed(2)} pts
              </strong>
            </span>
            <span className="text-blue-600 font-medium">Weight: {route.traffic_weight_pct}%</span>
          </div>
        </div>

        {/* Advance Purchase Curve Chart (approx 65% / 8 cols) */}
        <div className="lg:col-span-8 bg-white border border-[#E4E7EC] rounded-lg p-5 shadow-xs min-w-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-[#101828]">Advance Purchase Curve (Yield Curve)</h3>
              <p className="text-[11px] text-[#667085]">
                How departure proximity affects observed fares: T+45 down to T+1 (Emergency departure)
              </p>
            </div>
            <span className="text-xs bg-slate-100 text-[#475467] px-2 py-0.5 rounded font-mono">
              Lead Time Compression
            </span>
          </div>

          <RouteAdvancePurchaseChart
            curveData={route.advance_purchase_curve}
            selectedWindows={selectedWindows}
          />
        </div>
      </div>

      {/* Multi-Source Comparison Table */}
      <div className="bg-white border border-[#E4E7EC] rounded-lg shadow-xs p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-[#101828]">Cross-Channel Source Comparison</h3>
            <p className="text-[11px] text-[#667085]">
              Evaluate multi-source price convergence between Airline Direct portals and major Online Travel Aggregators (OTAs)
            </p>
          </div>
          <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            Source Agreement: 98.2% Convergent
          </span>
        </div>

        <div className="overflow-x-auto border border-[#E4E7EC] rounded">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] text-[#475467] font-semibold border-b border-[#E4E7EC] text-[11px] uppercase">
              <tr>
                <th className="p-3">Source Channel</th>
                <th className="p-3">Channel Type</th>
                <th className="p-3 text-right">Median Fare</th>
                <th className="p-3 text-right">Lowest Observed</th>
                <th className="p-3 text-right">Observations Today</th>
                <th className="p-3 text-center">Freshness</th>
                <th className="p-3 text-center">Agreement State</th>
                <th className="p-3 text-right">Reliability Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {route.sources_comparison.map((src, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-semibold text-[#101828]">{src.source_name}</td>
                  <td className="p-3 text-[#667085]">{src.source_type}</td>
                  <td className="p-3 text-right font-bold text-[#101828] tabular-nums">{formatINR(src.median_fare)}</td>
                  <td className="p-3 text-right text-[#475467] tabular-nums">{formatINR(src.min_fare)}</td>
                  <td className="p-3 text-right font-mono text-[#101828] tabular-nums">{src.observations}</td>
                  <td className="p-3 text-center text-[#667085] font-mono text-[11px]">{src.freshness}</td>
                  <td className="p-3 text-center">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-emerald-100 text-emerald-800">
                      {src.agreement_status}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-blue-700">
                    {(src.reliability_score * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
