'use client';

import React, { useState } from 'react';
import { Database, Search, ShieldCheck, Download, Filter } from 'lucide-react';
import { FareObservation } from '@/types';
import { FareProvenanceDrawer } from '@/components/drawers/FareProvenanceDrawer';
import { OriginBadge } from '@/components/ui/Badge';
import { formatINR } from '@/lib/formatters';
import { notify } from '@/lib/notify';

const MOCK_FARES: FareObservation[] = [
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
];

export default function FaresPage() {
  const [selectedFare, setSelectedFare] = useState<FareObservation | null>(null);

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
            onClick={() => {
              notify.loading('Preparing fare export...', { id: 'fare-export' });
              setTimeout(() => {
                notify.download(
                  'airpulse-fares-DEL-BOM-2026-09-02.csv',
                  '28,452 observations • 4.8 MB',
                  () => notify.info('Download started')
                );
              }, 600);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#D0D5DD] text-xs font-semibold text-[#101828] rounded shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Export Verified Quotes</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E4E7EC] rounded-lg shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
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
              {MOCK_FARES.map((fare) => (
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
                      className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold rounded text-[11px] transition-colors"
                    >
                      Audit Trail →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provenance Drawer */}
      <FareProvenanceDrawer fare={selectedFare} onClose={() => setSelectedFare(null)} />
    </div>
  );
}
