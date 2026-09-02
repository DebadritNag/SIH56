'use client';

import React, { useState, useMemo } from 'react';
import { Database, Search, ShieldCheck, Download, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { FareObservation } from '@/types';
import { FareProvenanceDrawer } from '@/components/drawers/FareProvenanceDrawer';
import { ExportDialog } from '@/components/dialogs/ExportDialog';
import { OriginBadge } from '@/components/ui/Badge';
import { formatINR } from '@/lib/formatters';
import { GenerateReportButton } from '@/components/data/GenerateReportButton';
import { notify } from '@/lib/notify';
import { clsx } from 'clsx';

const ALL_MOCK_FARES: FareObservation[] = [
  {
    id: 'fare-9101',
    collected_at: '17:42:08 IST',
    route: 'DEL → BOM',
    departure_date: '09 Sep 2026',
    booking_window: 'T+7',
    airline: 'IndiGo',
    flight_number: '6E-2041',
    source: 'OTA Source 01',
    base_fare: 6400,
    taxes: 1080,
    fees: 0,
    total_fare: 7480,
    validation_status: 'VALID',
    anomaly_status: 'NORMAL',
    origin_type: 'LIVE',
    provenance: {
      collection_run_id: '1842',
      response_hash: 'a9f24c7e81b6e45d911b3320f3a44d18ce54687d993e3d93',
      collector_version: '1.4.2',
      parser_version: 'parser-v2.0',
      fareguard_prediction: 7120,
      priceguard_score: 0.12,
      index_eligible: true,
      pipeline_steps: [],
    },
  },
  {
    id: 'fare-9102',
    collected_at: '17:42:08 IST',
    route: 'DEL → BOM',
    departure_date: '09 Sep 2026',
    booking_window: 'T+7',
    airline: 'Air India',
    flight_number: 'AI-865',
    source: 'Airline Direct',
    base_fare: 6800,
    taxes: 1120,
    fees: 0,
    total_fare: 7920,
    validation_status: 'VALID',
    anomaly_status: 'NORMAL',
    origin_type: 'LIVE',
    provenance: {
      collection_run_id: '1842',
      response_hash: 'c4a91924b8e2194c7a10239102ef1904a883190cb64d2918',
      collector_version: '2.1.0',
      parser_version: 'parser-v2.0',
      fareguard_prediction: 7540,
      priceguard_score: 0.18,
      index_eligible: true,
      pipeline_steps: [],
    },
  },
  {
    id: 'fare-9103',
    collected_at: '17:42:09 IST',
    route: 'DEL → BOM',
    departure_date: '03 Sep 2026',
    booking_window: 'T+1',
    airline: 'IndiGo',
    flight_number: '6E-5021',
    source: 'OTA Source 02',
    base_fare: 9800,
    taxes: 1400,
    fees: 0,
    total_fare: 11200,
    validation_status: 'VALID',
    anomaly_status: 'ANOMALOUS',
    origin_type: 'LIVE',
    provenance: {
      collection_run_id: '1842',
      response_hash: 'e81a30b467e98d249f011933c09b88219468bf039478aa91',
      collector_version: '1.4.2',
      parser_version: 'parser-v2.0',
      fareguard_prediction: 7100,
      priceguard_score: 0.99,
      index_eligible: true,
      pipeline_steps: [],
    },
  },
  {
    id: 'fare-9104',
    collected_at: '17:42:10 IST',
    route: 'DEL → BLR',
    departure_date: '09 Sep 2026',
    booking_window: 'T+7',
    airline: 'Akasa Air',
    flight_number: 'QP-1102',
    source: 'OTA Source 01',
    base_fare: 5900,
    taxes: 1020,
    fees: 0,
    total_fare: 6920,
    validation_status: 'VALID',
    anomaly_status: 'NORMAL',
    origin_type: 'LIVE',
    provenance: {
      collection_run_id: '1842',
      response_hash: '8f7a91c049d113426e9f9024c8033ef1904a883190cb64d2',
      collector_version: '1.4.2',
      parser_version: 'parser-v2.0',
      fareguard_prediction: 6850,
      priceguard_score: 0.08,
      index_eligible: true,
      pipeline_steps: [],
    },
  },
  {
    id: 'fare-9105',
    collected_at: '17:42:12 IST',
    route: 'BOM → BLR',
    departure_date: '18 Sep 2026',
    booking_window: 'T+15',
    airline: 'IndiGo',
    flight_number: '6E-412',
    source: 'Airline Direct',
    base_fare: 4600,
    taxes: 810,
    fees: 0,
    total_fare: 5410,
    validation_status: 'VALID',
    anomaly_status: 'NORMAL',
    origin_type: 'LIVE',
    provenance: {
      collection_run_id: '1842',
      response_hash: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f',
      collector_version: '2.1.0',
      parser_version: 'parser-v2.0',
      fareguard_prediction: 5350,
      priceguard_score: 0.04,
      index_eligible: true,
      pipeline_steps: [],
    },
  },
  {
    id: 'fare-9106',
    collected_at: '17:42:15 IST',
    route: 'DEL → CCU',
    departure_date: '02 Oct 2026',
    booking_window: 'T+30',
    airline: 'SpiceJet',
    flight_number: 'SG-8192',
    source: 'OTA Source 02',
    base_fare: 4300,
    taxes: 820,
    fees: 0,
    total_fare: 5120,
    validation_status: 'VALID',
    anomaly_status: 'NORMAL',
    origin_type: 'LIVE',
    provenance: {
      collection_run_id: '1842',
      response_hash: 'b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4',
      collector_version: '1.4.2',
      parser_version: 'parser-v2.0',
      fareguard_prediction: 5050,
      priceguard_score: 0.06,
      index_eligible: true,
      pipeline_steps: [],
    },
  },
  {
    id: 'fare-9107',
    collected_at: '17:42:18 IST',
    route: 'BOM → GOI',
    departure_date: '17 Oct 2026',
    booking_window: 'T+45',
    airline: 'Air India Express',
    flight_number: 'IX-1204',
    source: 'Airline Direct',
    base_fare: 2600,
    taxes: 650,
    fees: 0,
    total_fare: 3250,
    validation_status: 'VALID',
    anomaly_status: 'NORMAL',
    origin_type: 'LIVE',
    provenance: {
      collection_run_id: '1842',
      response_hash: 'c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5',
      collector_version: '2.1.0',
      parser_version: 'parser-v2.0',
      fareguard_prediction: 3100,
      priceguard_score: 0.03,
      index_eligible: true,
      pipeline_steps: [],
    },
  },
];

const WINDOW_TAGS = ['T+1', 'T+7', 'T+15', 'T+30', 'T+45'];

export default function FaresPage() {
  const [selectedFare, setSelectedFare] = useState<FareObservation | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  // Analytical Filters
  const [routeFilter, setRouteFilter] = useState<string>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [selectedWindows, setSelectedWindows] = useState<string[]>(['T+1', 'T+7', 'T+15', 'T+30', 'T+45']);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const toggleWindow = (win: string) => {
    if (selectedWindows.includes(win)) {
      if (selectedWindows.length === 1) return;
      setSelectedWindows(selectedWindows.filter((w) => w !== win));
    } else {
      setSelectedWindows([...selectedWindows, win]);
    }
  };

  const handleReset = () => {
    setRouteFilter('ALL');
    setSourceFilter('ALL');
    setSelectedWindows(['T+1', 'T+7', 'T+15', 'T+30', 'T+45']);
    setSearchQuery('');
  };

  const filteredFares = useMemo(() => {
    return ALL_MOCK_FARES.filter((f) => {
      if (routeFilter !== 'ALL' && !f.route.includes(routeFilter)) return false;
      if (sourceFilter !== 'ALL' && !f.source.includes(sourceFilter)) return false;
      if (!selectedWindows.includes(f.booking_window)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          f.airline.toLowerCase().includes(q) ||
          f.flight_number.toLowerCase().includes(q) ||
          f.route.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [routeFilter, sourceFilter, selectedWindows, searchQuery]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl md:text-2xl font-bold text-[#101828] tracking-tight">
              Fare Explorer &amp; Observation Provenance
            </h1>
          </div>
          <p className="text-xs text-[#475467] mt-0.5">
            Query individual collected quotes. Every observed fare is tied to an immutable raw payload SHA-256 hash, collector version, and full transformation audit trail.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#D0D5DD] text-xs font-semibold text-[#101828] rounded shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Export Verified Quotes</span>
          </button>
          <GenerateReportButton
            exportType={'FARE_OBSERVATIONS' as never}
            format={'CSV' as never}
            title="Validated Fare Observations Report"
            filters={{
              route: routeFilter === 'ALL' ? undefined : routeFilter,
              source: sourceFilter === 'ALL' ? undefined : sourceFilter,
              windows: selectedWindows,
            }}
          />
        </div>
      </div>

      <ExportDialog
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        exportType="FARE_OBSERVATIONS"
        defaultFormat="CSV"
        title="National Fare Observations (Validated)"
        filters={{
          route: routeFilter === 'ALL' ? undefined : routeFilter,
          source: sourceFilter === 'ALL' ? undefined : sourceFilter,
          booking_windows: selectedWindows,
        }}
        filterSummary={[
          { label: 'Corridor Filter', value: routeFilter === 'ALL' ? 'All Corridors' : routeFilter },
          { label: 'Source Filter', value: sourceFilter === 'ALL' ? 'All Sources' : sourceFilter },
          { label: 'Booking Windows', value: `${selectedWindows.length} Active` },
        ]}
        estimatedRows={filteredFares.length * 4000}
      />

      {/* Filter Bar */}
      <div className="bg-white border border-[#E4E7EC] rounded-lg p-2.5 px-4 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-[#667085] font-semibold uppercase text-[10px] tracking-wider">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          <select
            value={routeFilter}
            onChange={(e) => setRouteFilter(e.target.value)}
            className="bg-[#F8FAFC] border border-[#D0D5DD] text-[#101828] font-medium rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">All Routes (81)</option>
            <option value="DEL → BOM">DEL → BOM</option>
            <option value="DEL → BLR">DEL → BLR</option>
            <option value="BOM → BLR">BOM → BLR</option>
            <option value="DEL → CCU">DEL → CCU</option>
            <option value="BOM → GOI">BOM → GOI</option>
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="bg-[#F8FAFC] border border-[#D0D5DD] text-[#101828] font-medium rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">All Sources</option>
            <option value="Airline Direct">Airline Direct</option>
            <option value="OTA Source 01">OTA Source 01</option>
            <option value="OTA Source 02">OTA Source 02</option>
          </select>

          {/* Booking Window Buttons */}
          <div className="flex items-center gap-1 bg-[#F1F5F9] p-0.5 rounded border border-[#E2E8F0]">
            <button
              onClick={() => setSelectedWindows(['T+1', 'T+7', 'T+15', 'T+30', 'T+45'])}
              className={clsx(
                'px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer',
                selectedWindows.length === 5 ? 'bg-white text-blue-700 shadow-2xs' : 'text-[#64748B]'
              )}
            >
              All
            </button>
            {WINDOW_TAGS.map((win) => {
              const active = selectedWindows.includes(win);
              return (
                <button
                  key={win}
                  onClick={() => toggleWindow(win)}
                  className={clsx(
                    'px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer',
                    active ? 'bg-white text-blue-700 shadow-2xs border border-blue-200' : 'text-[#94A3B8] hover:text-[#475467]'
                  )}
                >
                  {win}
                </button>
              );
            })}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Search carrier or flight..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-2.5 py-1 bg-[#F8FAFC] border border-[#D0D5DD] rounded text-xs text-[#101828] focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-[11px] font-semibold text-[#667085] hover:text-[#101828] px-2 py-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>

        <div className="text-xs text-[#667085]">
          Showing <strong className="text-[#101828]">{filteredFares.length}</strong> matching observations
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E4E7EC] rounded-lg shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          {filteredFares.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#667085]">
              No observations match the selected filters. Click Reset to restore all fares.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] text-[#475467] font-semibold border-b border-[#E4E7EC] text-[11px] uppercase">
                <tr>
                  <th className="p-3">Collected (IST)</th>
                  <th className="p-3">Route</th>
                  <th className="p-3">Departure Date</th>
                  <th className="p-3">Window</th>
                  <th className="p-3">Carrier / Flight</th>
                  <th className="p-3">Source</th>
                  <th className="p-3 text-right">Base Fare</th>
                  <th className="p-3 text-right">Taxes/Fees</th>
                  <th className="p-3 text-right">Total Fare</th>
                  <th className="p-3 text-center">Validation</th>
                  <th className="p-3 text-center">Origin</th>
                  <th className="p-3 text-right">Lineage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {filteredFares.map((fare) => (
                  <tr
                    key={fare.id}
                    onClick={() => setSelectedFare(fare)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="p-3 font-mono text-[#667085]">{fare.collected_at}</td>
                    <td className="p-3 font-bold text-[#101828]">{fare.route}</td>
                    <td className="p-3 text-[#475467]">{fare.departure_date}</td>
                    <td className="p-3 font-semibold text-blue-700">{fare.booking_window}</td>
                    <td className="p-3 text-[#101828]">
                      <span className="font-semibold">{fare.airline}</span>
                      <span className="text-[#667085] ml-1 font-mono">({fare.flight_number})</span>
                    </td>
                    <td className="p-3 text-[#475467]">{fare.source}</td>
                    <td className="p-3 text-right tabular-nums text-[#667085]">{formatINR(fare.base_fare)}</td>
                    <td className="p-3 text-right tabular-nums text-[#667085]">{formatINR(fare.taxes + fare.fees)}</td>
                    <td className="p-3 text-right tabular-nums font-bold text-[#101828]">{formatINR(fare.total_fare)}</td>
                    <td className="p-3 text-center">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-emerald-100 text-emerald-800">
                        {fare.validation_status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <OriginBadge origin={fare.origin_type} />
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFare(fare);
                        }}
                        className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold rounded text-[11px] transition-colors cursor-pointer"
                      >
                        Audit Trail →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Provenance Drawer */}
      <FareProvenanceDrawer fare={selectedFare} onClose={() => setSelectedFare(null)} />
    </div>
  );
}
