'use client';

import React, { useState, useMemo } from 'react';
import { Bell } from 'lucide-react';
import { SeverityBadge } from '@/components/ui/Badge';
import { useDataMode } from '@/lib/providers/DataModeProvider';
import { useAlerts } from '@/lib/hooks/useResources';
import { DataSourceMeta } from '@/components/data/DataBadge';
import { EmptyAlertsState } from '@/components/states/EmptyState';

type Sev = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

interface AlertItem {
  id: string;
  type: string;
  severity: Sev;
  title: string;
  time: string;
  message: string;
  acknowledged: boolean;
}

const MOCK_ALERTS: AlertItem[] = [
  { id: 'ALT-1049', type: 'MARKET_SHOCK', severity: 'CRITICAL', title: 'Severe Airfare Surge Detected on DEL-BOM (T+1)', time: '15:10 IST Today', message: 'Median fare increased +42.8% to ₹11,840. Verified across 4 independent sources.', acknowledged: false },
  { id: 'ALT-1048', type: 'SOURCE_DEGRADED', severity: 'HIGH', title: 'OTA Source 03 (Cleartrip) Latency Spike', time: '14:22 IST Today', message: 'Average response time reached 1,450ms; success rate degraded to 88.4%.', acknowledged: false },
  { id: 'ALT-1047', type: 'DATA_QUALITY', severity: 'MEDIUM', title: 'Coverage Drop on Regional Sub-Corridors', time: '11:05 IST Today', message: 'T+45 advance window dropped below 80% coverage on CCU-GAU route.', acknowledged: true },
  { id: 'ALT-1046', type: 'SYSTEM_HEALTH', severity: 'LOW', title: 'Scheduled Celery Beat Collection Succeeded', time: '09:06 IST Today', message: 'Batch collection #1839 ingested 8,425 raw quotes with 97.2% validation rate.', acknowledged: true },
];

function normalizeSeverity(s: unknown): Sev {
  const v = String(s || '').toUpperCase();
  if (v === 'CRITICAL' || v === 'HIGH' || v === 'MEDIUM' || v === 'LOW') return v;
  return 'MEDIUM';
}

export default function AlertsPage() {
  const { mode } = useDataMode();
  const isMock = mode === 'mock';
  const { data: alertPage } = useAlerts({ page_size: 50 });

  const liveAlerts: AlertItem[] = useMemo(() => {
    const items = (alertPage as { items?: Record<string, unknown>[] } | undefined)?.items ?? [];
    return items.map((a, i) => ({
      id: String(a.id ?? `ALERT-${i}`),
      type: String(a.alert_type ?? 'ALERT'),
      severity: normalizeSeverity(a.severity),
      title: String(a.title ?? 'Alert'),
      time: a.created_at ? new Date(String(a.created_at)).toLocaleString() : '—',
      message: String(a.message ?? ''),
      acknowledged: String(a.status ?? '').toUpperCase() !== 'OPEN',
    }));
  }, [alertPage]);

  const [localAck, setLocalAck] = useState<Record<string, boolean>>({});
  const base = isMock ? MOCK_ALERTS : liveAlerts;
  const alerts = base.map((a) => (a.id in localAck ? { ...a, acknowledged: localAck[a.id] } : a));
  const toggleAck = (id: string) => setLocalAck((p) => ({ ...p, [id]: !alerts.find((a) => a.id === id)?.acknowledged }));

  return (
    <div className="space-y-5">
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
          <div className="mt-1.5">
            <DataSourceMeta isMock={isMock} source={isMock ? 'Demo dataset' : 'AirPulse backend (live)'} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-rose-50 text-rose-800 border border-rose-200 font-bold text-xs rounded">
            {alerts.filter((a) => !a.acknowledged).length} Unacknowledged Alerts
          </span>
        </div>
      </div>

      {alerts.length === 0 ? (
        <EmptyAlertsState layout="card" />
      ) : (
        <div className="bg-white border border-[#E4E7EC] rounded-lg shadow-xs overflow-hidden divide-y divide-[#F1F5F9]">
          {alerts.map((alert) => (
            <div key={alert.id} className="p-4 flex items-start justify-between gap-4 hover:bg-slate-50 transition-colors">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <SeverityBadge severity={alert.severity} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#101828]">{alert.id.slice(0, 12)}</span>
                    <span className="text-xs font-bold text-[#101828]">{alert.title}</span>
                  </div>
                  <p className="text-xs text-[#475467] mt-1">{alert.message}</p>
                  <span className="text-[11px] text-[#667085] font-mono mt-1.5 block">{alert.time}</span>
                </div>
              </div>
              <button
                onClick={() => toggleAck(alert.id)}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors shrink-0 cursor-pointer ${
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
      )}
    </div>
  );
}
