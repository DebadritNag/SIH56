'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getData } from '@/lib/api/client';
import { useDataMode } from '@/lib/providers/DataModeProvider';

export function LiveDataGate({ children }: { children: ReactNode }) {
  const { mode } = useDataMode();
  const path = usePathname();
  const client = useQueryClient();
  const previous = useRef<boolean | undefined>(undefined);
  const q = useQuery({
    queryKey: ['ingestion-readiness', mode],
    queryFn: () => getData<{ ready: boolean; observations: number }>('/ingestion/readiness'),
    enabled: mode === 'real', refetchInterval: 3000,
  });
  useEffect(() => {
    if (q.data?.ready && previous.current === false) void client.invalidateQueries();
    previous.current = q.data?.ready;
  }, [q.data?.ready, client]);
  const management = ['/ingestion', '/scraping-test', '/sources', '/settings'];
  if (mode === 'mock' || management.some(p => path === p || path.startsWith(p + '/'))) return children;
  if (q.isPending) return <p className="p-8 text-slate-500">Checking processed observations…</p>;
  if (q.isError) return <div className="p-8">Unable to check ingestion status. <button onClick={() => void q.refetch()}>Retry</button></div>;
  if (!q.data?.ready) return <div className="rounded-xl border bg-white p-10 text-center space-y-3">
    <h1 className="text-xl font-semibold">No processed data published yet</h1>
    <p className="text-slate-500">Run Collection to process your imported observations and available live fares. Charts will populate from those records.</p>
    <Link className="inline-block rounded bg-blue-600 px-4 py-2 text-white" href="/ingestion">Open Data Ingestion</Link>
  </div>;
  return children;
}
