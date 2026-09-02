'use client';

import React, { useState } from 'react';
import { Bell, AlertTriangle, ShieldAlert, CheckCircle2, Info } from 'lucide-react';
import { SeverityBadge } from '@/components/ui/Badge';

const ALERTS = [
  { id: 'ALT-1049', type: 'MARKET_SHOCK', severity: 'CRITICAL' as const, title: 'Severe Airfare Surge Detected on DEL-BOM (T+1)', time: '15:10 IST Today', message: 'Median fare increased +42.8% to ₹11,840. Verified across 4 independent sources.', acknowledged: false },
  { id: 'ALT-1048', type: 'SOURCE_DEGRADED', severity: 'HIGH' as const, title: 'OTA Source 03 (Cleartrip) Latency Spike', time: '14:22 IST Today', message: 'Average response time reached 1,450ms; success rate degraded to 88.4%.', acknowledged: false },
  { id: 'ALT-1047', type: 'DATA_QUALITY', severity: 'MEDIUM' as const, title: 'Coverage Drop on Regional Sub-Corridors', time: '11:05 IST Today', message: 'T+45 advance window dropped below 80% coverage on CCU-GAU route.', acknowledged: true },
  { id: 'ALT-1046', type: 'SYSTEM_HEALTH', severity: 'LOW' as const, title: 'Scheduled Celery Beat Collection Succeeded', time: '09:06 IST Today', message: 'Batch collection #1839 ingested 8,425 raw quotes with 97.2% validation rate.', acknowledged: true },
];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState(ALERTS);

  const toggleAck = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, acknowledged: !a.acknowledged } : a))
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl md:text-2xl font-bold text-[#101828] tracking-tight">
              Alerts &amp; Intelligence Notification Center
            </h1>
          </div>
          <p className="text-xs text-[#475467] mt-0.5">
            Operational and statistical alerts across price shocks, source degradations, and data coverage thresholds.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-rose-50 text-rose-800 border border-rose-200 font-bold text-xs rounded">
            {alerts.filter((a) => !a.acknowledged).length} Unacknowledged Alerts
          </span>
        </div>
      </div>

      {/* Alerts List */}
      <div className="bg-white border border-[#E4E7EC] rounded-lg shadow-xs overflow-hidden divide-y divide-[#F1F5F9]">
        {alerts.map((alert) => (
          <div key={alert.id} className="p-4 flex items-start justify-between gap-4 hover:bg-slate-50 transition-colors">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <SeverityBadge severity={alert.severity} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-[#101828]">{alert.id}</span>
                  <span className="text-xs font-bold text-[#101828]">{alert.title}</span>
                </div>
                <p className="text-xs text-[#475467] mt-1">{alert.message}</p>
                <span className="text-[11px] text-[#667085] font-mono mt-1.5 block">{alert.time}</span>
              </div>
            </div>

            <button
              onClick={() => toggleAck(alert.id)}
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors shrink-0 ${
                alert.acknowledged
                  ? 'bg-slate-100 text-[#475467] hover:bg-slate-200'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-2xs'
              }`}
            >
              {alert.acknowledged ? 'Mark Unread' : 'Acknowledge'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
